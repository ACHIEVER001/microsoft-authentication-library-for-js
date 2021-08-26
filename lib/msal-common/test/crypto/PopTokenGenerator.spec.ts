import sinon from "sinon";
import { RANDOM_TEST_GUID, TEST_POP_VALUES, TEST_DATA_CLIENT_INFO, TEST_CONFIG, TEST_URIS, DECRYPTED_BOUND_RT_AUTHENTICATION_RESULT_DEFAULT_SCOPES, RANDOM_TEST_CTX, SIGNED_BOUND_TOKEN_REQUEST } from "../test_kit/StringConstants";
import { PopTokenGenerator } from "../../src/crypto/PopTokenGenerator";
import { ICrypto, PkceCodes } from "../../src/crypto/ICrypto";
import { BaseAuthRequest } from "../../src/request/BaseAuthRequest";
import { TimeUtils } from "../../src/utils/TimeUtils";
import { UrlString } from "../../src/url/UrlString";
import { AuthenticationScheme } from "../../src/utils/Constants";
import { SignedHttpRequest } from "../../src/crypto/SignedHttpRequest";
import { ServerAuthorizationTokenResponse } from "../../src/response/ServerAuthorizationTokenResponse";

describe("PopTokenGenerator Unit Tests", () => {

    afterEach(() => {
        sinon.restore();
    });

    const cryptoInterface: ICrypto = {
        createNewGuid(): string {
            return RANDOM_TEST_GUID;
        },
        createNewCtx(): Uint8Array {
            return RANDOM_TEST_CTX;
        },
        base64Decode(input: string): string {
            switch (input) {
                case TEST_POP_VALUES.ENCODED_REQ_CNF:
                    return TEST_POP_VALUES.DECODED_REQ_CNF;
                case TEST_DATA_CLIENT_INFO.TEST_RAW_CLIENT_INFO:
                    return TEST_DATA_CLIENT_INFO.TEST_DECODED_CLIENT_INFO;
                case TEST_POP_VALUES.SAMPLE_POP_AT_PAYLOAD_ENCODED:
                    return TEST_POP_VALUES.SAMPLE_POP_AT_PAYLOAD_DECODED;
                default:
                    return input;
            }
        },
        base64Encode(input: string): string {
            switch (input) {
                case "123-test-uid":
                    return "MTIzLXRlc3QtdWlk";
                case "456-test-uid":
                    return "NDU2LXRlc3QtdWlk";
                case TEST_POP_VALUES.DECODED_REQ_CNF:
                    return TEST_POP_VALUES.ENCODED_REQ_CNF;
                case TEST_POP_VALUES.SAMPLE_POP_AT_PAYLOAD_DECODED:
                    return TEST_POP_VALUES.SAMPLE_POP_AT_PAYLOAD_ENCODED;
                default:
                    return input;
            }
        },
        async generatePkceCodes(): Promise<PkceCodes> {
            return {
                challenge: TEST_CONFIG.TEST_CHALLENGE,
                verifier: TEST_CONFIG.TEST_VERIFIER
            }
        },
        async getPublicKeyThumbprint(): Promise<string> {
            return TEST_POP_VALUES.KID;
        },
        async signJwt(): Promise<string> {
            return "";
        },
        async removeTokenBindingKey(): Promise<boolean> {
            return Promise.resolve(true);
        },
        async clearKeystore(): Promise<boolean> {
            return Promise.resolve(true);
        },
        async getAsymmetricPublicKey(): Promise<string> {
            return TEST_POP_VALUES.DECODED_STK_JWK_THUMBPRINT
        },
        async decryptBoundTokenResponse(): Promise<ServerAuthorizationTokenResponse> {
            return DECRYPTED_BOUND_RT_AUTHENTICATION_RESULT_DEFAULT_SCOPES;
        },
        async signBoundTokenRequest(): Promise<string> {
            return SIGNED_BOUND_TOKEN_REQUEST;
        }
    };

    describe("signPopToken", () => {
        let currTime: number;
        let testRequest: BaseAuthRequest;
        
        beforeAll(() => {
            currTime = TimeUtils.nowSeconds();
            testRequest = {
                authority: TEST_CONFIG.validAuthority,
                scopes: TEST_CONFIG.DEFAULT_GRAPH_SCOPE,
                correlationId: TEST_CONFIG.CORRELATION_ID,
            };
            sinon.stub(TimeUtils, "nowSeconds").returns(currTime);
        });

        it("Signs the proof-of-possession JWT token with all PoP parameters in the request", (done) => {
            const popTokenGenerator = new PopTokenGenerator(cryptoInterface);
            const accessToken = TEST_POP_VALUES.SAMPLE_POP_AT;
            const resourceReqMethod = "POST";
            const resourceUrl = TEST_URIS.TEST_RESOURCE_ENDPT_WITH_PARAMS;
            const resourceUrlString = new UrlString(resourceUrl);
            const resourceUrlComponents = resourceUrlString.getUrlComponents();
            const currTime = TimeUtils.nowSeconds();
            const shrClaims = TEST_POP_VALUES.CLIENT_CLAIMS;

            // Set PoP parameters in auth request
            const popRequest = {
                ...testRequest,
                authenticationScheme: AuthenticationScheme.POP,
                resourceRequestMethod: resourceReqMethod,
                resourceRequestUri: resourceUrl,
                shrClaims: shrClaims
            }


            cryptoInterface.signJwt = (payload: SignedHttpRequest, kid: string): Promise<string> => {
                expect(kid).toBe(TEST_POP_VALUES.KID);
                const expectedPayload = {
                    at: accessToken,
                    ts: currTime,
                    m: resourceReqMethod,
                    u: resourceUrlComponents.HostNameAndPort,
                    nonce: RANDOM_TEST_GUID,
                    p: resourceUrlComponents.AbsolutePath,
                    q: [[], resourceUrlComponents.QueryString],
                    client_claims: shrClaims
                };
                
                expect(payload).toEqual(expectedPayload);
                done();
                return Promise.resolve("");
            };
            popTokenGenerator.signPopToken(accessToken, popRequest);
        });

        it("Signs the proof-of-possession JWT token when PoP parameters are undefined", (done) => {
            const popTokenGenerator = new PopTokenGenerator(cryptoInterface);
            const accessToken = TEST_POP_VALUES.SAMPLE_POP_AT;
            const currTime = TimeUtils.nowSeconds();
            cryptoInterface.signJwt = (payload: SignedHttpRequest, kid: string): Promise<string> => {
                expect(kid).toBe(TEST_POP_VALUES.KID);
                const expectedPayload = {
                    at: accessToken,
                    ts: currTime,
                    m: undefined,
                    u: undefined,
                    nonce: RANDOM_TEST_GUID,
                    p: undefined,
                    q: undefined,
                    client_claims: undefined
                };
                
                expect(payload).toEqual(expectedPayload);
                done();
                return Promise.resolve("");
            };
            popTokenGenerator.signPopToken(accessToken, testRequest);
        });
    });
});
