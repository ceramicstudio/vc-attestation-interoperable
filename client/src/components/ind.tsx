import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { GraphiQL } from "graphiql";
import Link from "next/link";
import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { definition } from "../__generated__/definition.js";
import { ICreateVerifiableCredentialEIP712Args } from "@veramo/credential-eip712";
import { Web3KeyManagementSystem } from "@veramo/kms-web3";
import { getEthTypesFromInputDoc } from "eip-712-types-generation";
import { CredentialPayload } from "@veramo/core";
import {
  extractIssuer,
  processEntryToArray,
  MANDATORY_CREDENTIAL_CONTEXT,
} from "@veramo/utils";
import "graphiql/graphiql.min.css";
import { ethers } from "ethers";

enum ClaimTypes {
  verifiableCredential = "verifiableCredential",
  attestation = "attestation",
}

type Queries = {
  values: [{ query: string }, { query: string }];
};

export default function Attest() {
  const [attesting, setAttesting] = useState(false);
  const [claim, setClaim] = useState<ClaimTypes>(ClaimTypes.attestation);
  const [signature, setSignature] = useState<"EIP712" | "JWT">("EIP712");
  const [loggedIn, setLoggedIn] = useState(false);
  const [destination, setDestination] = useState<string>("");
  const [queries, setQueries] = useState<Queries>({
    values: [
      {
        query: `query VerifiableCredentials{
        verifiableClaimIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              ...on VerifiableCredential{
                expirationDate
                context
                ...on VCEIP712Proof{
                  proof{
                    created
                  }
                  ...on AccountTrustCredential712{
                    trusted
                  }
                }
              }
            }
          }
        }
      }`,
      },
      {
        query: `query Attestations{
        verifiableClaimIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              ...on AccountAttestation{
                r
                s
                v
                trusted
              }
            }
          }
        }
      }`,
      }, // Add an empty query object to fix the type error
    ],
  });
  const { address, isDisconnected } = useAccount();

  const fetcher = async (graphQLParams: Record<string, any>) => {
    const composeClient = new ComposeClient({
      ceramic: "http://localhost:7007",
      definition: definition as RuntimeCompositeDefinition,
    });

    const data = await composeClient.executeQuery(`${graphQLParams.query}`);
    console.log(data);

    if (data && data.data && !data.data.__schema) {
      return data.data;
    }
  };

  const createNew = () => {
    const id = localStorage.getItem("did");
    if (!id) return;

    const cred = {
      issuer: id,
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/ld-context.json",
      ],
      type: ["VerifiableCredential", "TrustedReviewer"],
      credentialSchema: {
        id: "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/json-schema.json",
        type: "JsonSchemaValidator2018",
      },
      credentialSubject: {
        isTrusted: true,
        id: "did:pkh:eip155:1:0x514e3b94f0287caf77009039b72c321ef5f016e6",
      },
    };
    const credentialContext = processEntryToArray(
      cred?.["@context"],
      MANDATORY_CREDENTIAL_CONTEXT
    );
    const credentialType = processEntryToArray(
      cred?.type,
      "VerifiableCredential"
    );
    //@ts-ignore
    const issuer = extractIssuer(cred, { removeParameters: true });
    let chainId = 1;
    let issuanceDate = new Date().toISOString();

    const credFinal: CredentialPayload = {
      ...cred,
      "@context": credentialContext,
      type: credentialType,
      issuanceDate,
      proof: {
        verificationMethod: localStorage.getItem("did"),
        created: issuanceDate,
        proofPurpose: "assertionMethod",
        type: "EthereumEip712Signature2021",
      },
    };
    const message = credFinal;
    const domain = {
      chainId,
      name: "VerifiableCredential",
      version: "1",
    };
    const primaryType = "VerifiableCredential";
    const allTypes = getEthTypesFromInputDoc(credFinal, primaryType);
    const types = { ...allTypes };
    const data = JSON.stringify({ domain, types, message, primaryType });
    //@ts-ignore

    const sign = window.ethereum
      .request({
        method: "eth_signTypedData_v4",
        params: [address, data],
        from: address,
      })
      .then((signature: any) => {
        credFinal["proof"]["proofValue"] = signature;
        credFinal["proof"]["eip712"] = {
          domain,
          types: allTypes,
          primaryType,
        };
        console.log(credFinal);
      });
  };

  const createCredential = async () => {
    const response = await fetch(
      signature === "EIP712"
        ? `http://localhost:8080/create`
        : `http://localhost:8080/create-jws`,
      {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          id: localStorage.getItem("did"),
        }),
      }
    );
    const toJson = await response.json();
    const credential = await fetch(
      signature === "EIP712" ? `api/create` : `api/create-jwt`,
      {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          toJson,
        }),
      }
    );

    const toJsonCredential = await credential.json();

    console.log(toJsonCredential);
    return toJson;
  };

  const createAttestation = async () => {
    const response = await fetch("http://localhost:8080/create-attestation", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({
        address,
      }),
    });
    const toJson = await response.json();
    console.log(toJson);

    const attest = await fetch("/api/create-attest", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({
        toJson,
      }),
    });

    console.log(attest);

    const toJsonCredential = await attest.json();

    console.log(toJsonCredential);
  };

  const createClaim = async () => {
    if (claim === ("verifiableCredential" as ClaimTypes)) {
      const credential = await createCredential();
      console.log(credential);
    }
    if (claim === ("attestation" as ClaimTypes)) {
      const attestation = await createAttestation();
      console.log(attestation);
    }
  };

  useEffect(() => {
    if (address) {
      setLoggedIn(true);
    }
  }, [address]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="m-auto w-1/2 h-1/2">
        {address && (
          <div className="right">
            <img alt="Network logo" className="logo" src={"/ethlogo.png"} />

            <p style={{ textAlign: "center" }}>
              {" "}
              Connected with: {address.slice(0, 6)}...{address.slice(-4)}{" "}
            </p>
          </div>
        )}

        <div className="GradientBar" />
        <div className="WhiteBox">
          <>
          <div className="subTitle"> I trust: </div>
          <div className="InputContainer">
          <input
            className="InputBlock"
            autoCorrect={"off"}
            autoComplete={"off"}
            autoCapitalize={"off"}
            placeholder={"Address"}
            value={destination}
            onChange={(e) => setDestination(e.target.value.toLowerCase())}
          />
        </div>
            <div>Select claim format</div>
            <form className="px-4 py-3 m-3">
              <select
                className="text-center"
                onChange={(values) =>
                  setClaim(values.target.value as unknown as ClaimTypes)
                }
                value={claim}
              >
                <option value="attestation">Attestation</option>
                <option value="verifiableCredential">
                  Verifiable Credential
                </option>
              </select>
            </form>
            {/* @ts-ignore */}
            {claim === "verifiableCredential" && (
              <>
                <div>Select a signature format</div>
                <form className="px-4 py-3 m-3">
                  <select
                    className="text-center"
                    onChange={(values) =>
                      setSignature(
                        values.target.value as unknown as "EIP712" | "JWT"
                      )
                    }
                    value={signature}
                  >
                    <option value="EIP712">EIP712</option>
                    <option value="JWT">JWT</option>
                  </select>
                </form>
              </>
            )}
          </>
          <button className="MetButton" onClick={createClaim}>
            {attesting ? "Creating Claim..." : "Generate Claim"}
          </button>

          {address && (
            <>
              <div className="SubText"> </div>
              <div className="SubText">
                {" "}
                <Link href="/connections">Connections</Link>
              </div>
              <button onClick={createNew}>create new</button>
            </>
          )}
        </div>
      </div>
      {loggedIn && (
        <div style={{ height: "60rem", width: "90%", margin: "auto" }}>
          {/* @ts-ignore */}
          <GraphiQL
            fetcher={fetcher}
            // @ts-ignore
            storage={null}
            defaultTabs={queries.values}
          />
        </div>
      )}
    </div>
  );
}
