import type { JwtPayload, JwtHeader } from 'jwt-decode'
import type { DidDocument, DidService, VerificationMethod } from '@web5/dids'
import type { CryptoAlgorithm, JsonWebKey, Web5Crypto } from '@web5/crypto'

import { DidResolver, DidKeyMethod, DidIonMethod, DidDhtMethod, utils as didUtils } from '@web5/dids'
import { EcdsaAlgorithm, EdDsaAlgorithm, Jose } from '@web5/crypto'
import { Convert } from '@web5/common'

/**
 * A DID Resource is either a DID Document, a DID Verification method or a DID Service
 */
export type DidResource = DidDocument | VerificationMethod | DidService

type Verifier<T extends Web5Crypto.Algorithm> = {
  verifier: CryptoAlgorithm,
  options?: T
  alg: string
  crv: string
}

const secp256k1Verifier: Verifier<Web5Crypto.EcdsaOptions> = {
  verifier  : new EcdsaAlgorithm(),
  options : { name: 'ECDSA', hash: 'SHA-256' },
  alg     : 'ES256K',
  crv     : 'secp256k1'
}

const ed25519Verifier: Verifier<Web5Crypto.EdDsaOptions> = {
  verifier  : new EdDsaAlgorithm(),
  options : { name: 'EdDSA' },
  alg     : 'EdDSA',
  crv     : 'Ed25519'
}

export class JwtVerifier {
  /** supported cryptographic algorithms. keys are `${alg}:${crv}`. */
  static algorithms: { [alg: string]: Verifier<Web5Crypto.EcdsaOptions | Web5Crypto.EdDsaOptions> } = {
    'ES256K:'          : secp256k1Verifier,
    'ES256K:secp256k1' : secp256k1Verifier,
    ':secp256k1'       : secp256k1Verifier,
    'EdDSA:Ed25519'    : ed25519Verifier
  }

  // TODO: add caching by setting `cache` property when needed
  static didResolver = new DidResolver({ didResolvers: [DidIonMethod, DidKeyMethod, DidDhtMethod] })

  /**
   *
   * @param compactJwt
   * @returns signer's DID
   */
  static async verify(compactJwt) {
    const splitJwt = compactJwt.split('.')

    if (splitJwt.length !== 3) {
      throw new Error(`Verification failed: Malformed JWT. expected 3 parts. got ${splitJwt.length}`)
    }

    const [base64urlEncodedJwtHeader, base64urlEncodedJwtPayload, base64urlEncodedSignature] = splitJwt
    let jwtHeader: JwtHeader
    let jwtPayload: JwtPayload

    try {
      jwtHeader = Convert.base64Url(base64urlEncodedJwtHeader).toObject()
    } catch(e) {
      throw new Error('Verification failed: Malformed JWT. Invalid base64url encoding for JWT header')
    }

    if (!jwtHeader.typ || jwtHeader.typ !== 'JWT') {
      throw new Error('Verification failed: Expected JWT header to contain typ property set to JWT')
    }

    if (!jwtHeader.alg || !jwtHeader.kid) { // ensure that JWT header has required properties
      throw new Error('Verification failed: Expected JWT header to contain alg and kid')
    }

    // TODO: validate optional payload fields: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
    try {
      jwtPayload = Convert.base64Url(base64urlEncodedJwtPayload).toObject()
    } catch(e) {
      throw new Error('Verification failed: Malformed JWT. Invalid base64url encoding for JWT payload')
    }

    // TODO: should really be looking for verificationMethod with authentication verification relationship
    const verificationMethod = await JwtVerifier.deferenceDidUrl(jwtHeader.kid)
    if (!JwtVerifier.isVerificationMethod(verificationMethod)) { // ensure that appropriate verification method was found
      throw new Error('Verification failed: Expected kid in JWT header to dereference a DID Document Verification Method')
    }

    // will be used to verify signature
    const { publicKeyJwk } = verificationMethod
    if (!publicKeyJwk) { // ensure that Verification Method includes public key as a JWK.
      throw new Error('Verification failed: Expected kid in JWT header to dereference to a DID Document Verification Method with publicKeyJwk')
    }

    const signedData = `${base64urlEncodedJwtHeader}.${base64urlEncodedJwtPayload}`
    const signedDataBytes = Convert.string(signedData).toUint8Array()

    const signatureBytes = Convert.base64Url(base64urlEncodedSignature).toUint8Array()

    const algorithmId = `${jwtHeader.alg}:${publicKeyJwk['crv'] || ''}`
    if (!(algorithmId in JwtVerifier.algorithms)) {
      throw new Error(`Verification failed: ${algorithmId} not supported`)
    }

    const { verifier, options } = JwtVerifier.algorithms[algorithmId]

    // TODO: remove this monkeypatch once 'ext' is no longer a required property within a jwk passed to `jwkToCryptoKey`
    const monkeyPatchPublicKeyJwk = {
      alg: jwtHeader.alg,
      ...publicKeyJwk,
      ext     : 'true' as const,
      key_ops : ['verify']
    }

    const key = await Jose.jwkToCryptoKey({ key: monkeyPatchPublicKeyJwk as JsonWebKey })
    const isLegit = await verifier.verify({ algorithm: options, key, data: signedDataBytes, signature: signatureBytes })

    if (!isLegit) {
      throw new Error('Signature verification failed: Integrity mismatch')
    }

    return { signer: verificationMethod.controller, payload: jwtPayload }
  }

  static async resolveDid(did: string): Promise<DidDocument> {
    const { didResolutionMetadata, didDocument } = await JwtVerifier.didResolver.resolve(did)

    // TODO: remove the '?' after we ask OSE peeps about why DID ION resolution doesn't return didResolutionMetadata
    // despite being required as per the did-core spec
    if (didResolutionMetadata?.error) {
      throw new Error(`Failed to resolve DID: ${did}. Error: ${didResolutionMetadata.error}`)
    }

    return didDocument
  }

  static async deferenceDidUrl(didUrl: string): Promise<DidResource> {
    const parsedDid = didUtils.parseDid({ didUrl })
    if (!parsedDid) {
      throw new Error('failed to parse did')
    }

    const didDocument = await JwtVerifier.resolveDid(didUrl)

    // return the entire DID Document if no fragment is present on the did url
    if (!parsedDid.fragment) {
      return didDocument
    }

    const { service, verificationMethod } = didDocument

    // create a set of possible id matches. the DID spec allows for an id to be the entire did#fragment or just #fragment.
    // See: https://www.w3.org/TR/did-core/#relative-did-urls
    // using a set for fast string comparison. DIDs can be lonnng.
    const idSet = new Set([didUrl, parsedDid.fragment, `#${parsedDid.fragment}`])

    for (let vm of verificationMethod) {
      if (idSet.has(vm.id)) {
        return vm
      }
    }

    for (let svc of service) {
      if (idSet.has(svc.id)) {
        return svc
      }
    }
  }
  /**
   * type guard for {@link @web5/dids#VerificationMethod}
   * @param didResource - the resource to check
   * @returns true if the didResource is a `VerificationMethod`
   */
  static isVerificationMethod(didResource: DidResource): didResource is VerificationMethod {
    return didResource && 'id' in didResource && 'type' in didResource && 'controller' in didResource
  }
}