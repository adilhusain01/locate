import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, formatEther, http, isAddress, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@locate/sdk/chains";

export const runtime = "nodejs";

/// Testnet gas drip. Sends a little ETH on Robinhood Chain testnet to a wallet that has almost none, so a fresh
/// embedded wallet can pay for its first transactions. The key behind it is a burner; refuses when the recipient
/// already holds gas or the drip wallet runs low.
const DRIP = parseEther("0.002");
const MIN_RECIPIENT = parseEther("0.0015");
const MIN_RESERVE = parseEther("0.004");

export async function POST(request: Request) {
  const key = process.env.GAS_FAUCET_PRIVATE_KEY as Hex | undefined;
  if (!key) return NextResponse.json({ error: "Gas drip is not configured on this deployment." }, { status: 503 });
  let to: string;
  try {
    ({ to } = (await request.json()) as { to: string });
  } catch {
    return NextResponse.json({ error: "Send JSON with a `to` address." }, { status: 400 });
  }
  if (!to || !isAddress(to)) return NextResponse.json({ error: "That is not a valid address." }, { status: 400 });

  const rpc = process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
  const chain = { ...robinhoodTestnet, rpcUrls: { default: { http: [rpc] } } };
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });

  const [recipientBalance, dripBalance] = await Promise.all([pub.getBalance({ address: to }), pub.getBalance({ address: account.address })]);
  if (recipientBalance >= MIN_RECIPIENT) {
    return NextResponse.json({ error: `This wallet already holds ${formatEther(recipientBalance)} ETH, enough for many transactions.` }, { status: 409 });
  }
  if (dripBalance < MIN_RESERVE + DRIP) {
    return NextResponse.json({ error: "The drip wallet is running low. Use Robinhood's faucet for ETH instead." }, { status: 503 });
  }
  const hash = await wallet.sendTransaction({ to, value: DRIP });
  return NextResponse.json({ hash, amount: formatEther(DRIP) });
}
