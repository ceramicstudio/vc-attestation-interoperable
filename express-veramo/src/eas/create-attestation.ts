import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { CUSTOM_SCHEMAS } from "../../utils/utils.js";
import { ethers } from "ethers";

const KEY = process.env.KMS_SECRET_KEY || "";

export async function createAttestation(address: string) {
  const eas = new EAS("0xC2679fBD37d54388Ce493F1DB75320D236e1815e");

  // Gets a default provider (in production use something else like infura/alchemy)
  const provider = ethers.providers.getDefaultProvider("sepolia");
  eas.connect(provider);
  const offchain = await eas.getOffchain();

  const signer = new ethers.Wallet(KEY, provider);
  const schemaEncoder = new SchemaEncoder("bool Human");
  const encoded = schemaEncoder.encodeData([
    { name: "Human", type: "bool", value: true },
  ]);

  eas.connect(signer);
  const time = Math.floor(Date.now() / 1000);
  const offchainAttestation = await offchain.signOffchainAttestation(
    {
      recipient: address.toLowerCase(),
      // Unix timestamp of when attestation expires. (0 for no expiration)
      expirationTime: 0,
      // Unix timestamp of current time
      time,
      revocable: true,
      version: 1,
      nonce: 0,
      schema: CUSTOM_SCHEMAS.TRUST_SCHEMA,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encoded,
    },
    signer
  );
  return offchainAttestation;
}
