# Deployments

Web app: https://locate-pi.vercel.app (Vercel project `locate`, root directory `apps/web`, deployed from the repo root with the Vercel CLI; Deployment Protection is off so judges can open it). It talks to the Robinhood Chain testnet deployment below.

Addresses are written by `contracts/script/DeployTestnet.s.sol` to `contracts/deployments/<chainid>.json`.

| Network | Chain id | Status |
|---|---|---|
| Robinhood Chain testnet | 46630 | deployed 2026-10-02 (209 transactions, about 0.004 ETH); addresses below |
| Arbitrum Sepolia | 421614 | deployed 2026-10-02 (154 transactions, about 0.006 ETH), nine mock markets, Solidity router and engine; addresses below |
| Robinhood Chain mainnet | 4663 | read-only (fork tests and the price mirror) |

Deployer address (throwaway key, kept in the VPS `.env` only): `0x500FD8eD217C8dF1E458630489D8D80B443784F1`
Keeper address (throwaway key, kept in the VPS `.env` only): `0x319a9B7EA619Dd52c799209c111A5c348c9a3957`

Mainnet references used by the mirror and fork tests: USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, USDG/USD feed `0x61B7e5650328764B076A108EFF5fa7282a1B9aD2`, the 35 equity feeds and 194 Stock Tokens in `packages/sdk/registry/robinhood-mainnet.json`.

## Robinhood Chain testnet (46630), deployed 2026-10-02

The Controller was pointed at the Stylus risk engine and oracle router on 2026-10-02 after `scripts/diff-check.ts` found the Stylus and Solidity contracts identical on 40 random health evaluations, nine rate points, six auction points and all 14 live quotes. `scripts/configure-stylus.ts` holds the configuration (holidays, feeds, TWAP pools with a 30 minute window, sequencer and USDG feeds, keeper rights). The Solidity router and RiskMathRef stay deployed as the reference.

Deployer and owner: `0x610FdB41DA83138615C317c89fd9EB09271a46fe` (Adil's burner). Keeper: `0x319a9B7EA619Dd52c799209c111A5c348c9a3957`.
The official RPC `https://rpc.testnet.chain.robinhood.com` serves full state for forge scripts; `https://robinhood-sepolia-rpc.publicnode.com` and `https://robinhood-testnet.drpc.org` allow Stylus activation checks and deploys.

| Contract | Address |
|---|---|
| MockUSDG (collateral, faucet) | `0x62B2697e27DEcD2Ae494172c991814f38f493Bcd` |
| Controller | `0x58039eAeBB9d7bB56d1f3d1da9e5362D34AE8cF6` |
| OracleRouter (Solidity v0) | `0x3395E28437839E6E81eE77FECF827FFb29503386` |
| RiskMathRef | `0x86B86d390C225F1643c2C0C422AEe3b989171589` |
| MarketCalendar (Solidity) | `0xD14082935c1762504758d74B1d1ffB21f2f0383C` |
| ShortRouter | `0x02506EDF3cF27b806165CA929ba5a97eE885d445` |
| Liquidator | `0x6ef81De294cd0C11d99F01D0808b3AF7302eDebC` |
| Uniswap v3 factory | `0xA93f7BF760e4E4947a2151b38D22407f3c48fE1D` |
| Uniswap v3 SwapRouter | `0xB72704f3759077Df559725057c1212f47af27e4D` |
| LiquiditySeeder | `0x27487997EB47991c1b9C7DA4A9591C0cAdBAee41` |
| Sequencer feed (mock) | `0x42964c0BAf292b723598e1499B5E7f739B719515` |
| Stylus risk engine (live in the Controller) | `0x4b7c8bd51abda2ccf421312094e368895c8953f0` |
| Stylus market calendar | `0x0735725103ac33a4ed1c4919539c01139703c6ad` |
| Stylus oracle router (live in the Controller) | `0x2fc6e9895772017d769b3e6f7680f90ff7a154e7` |
| USDG/USD feed (mock, mirrored) | `0xb1a37B21ed242009A947cCD603BB8F5551e8F4E2` |

Markets. The first nine are Locate mocks priced from the mainnet feeds; AMD, AMZN, NFLX, PLTR and TSLA are the real faucet Stock Tokens (beacon proxies over `0x1df3ca0fd30ed5eeb09eb01938f4e9c5196e6ca5`), seeded from the deployer's faucet balance. Real testnet USDG from the faucet is `0x7E955252E15c84f5768B83c41a71F9eba181802F`; the protocol uses its own MockUSDG with a faucet because only 85 real units were available.

| Ticker | Token | Lending pool | Feed (mock, mirrored) | Uniswap v3 pool |
|---|---|---|---|---|
| NVDA | `0xBA1ee6f35C0a433B0Dfea7EcffBe4c43426cA5c0` | `0x2d2315964e124B177C298B4d7334471f58f8754a` | `0x388905A296Ff382E1f13391d1683Eea421826B8F` | `0x36b7d44791aFCf28F255CBB74790c9E2Ca9e4470` |
| SPY | `0x64412AB3983CCFbD6DFc3Dc41a11063cc839EF2F` | `0xD016167c8a5cEa10Aae3826233C58d0706286EDb` | `0x4c20689F617e173898c3F88b07b0978de48Ba4E1` | `0x532A43aa11f5d6FC40a3F4fCC152CD4319897891` |
| AAPL | `0xc64297c79832de0c7C42CBeE0D840a218C9E925e` | `0xc619EEB4E03488f1bDB4145086Db57FF3Ae9a20d` | `0x110b853b211C38E674F0EE10e81789138323C184` | `0x8e9DF605Fb348785f3847FC9E75762Cf6Cd52182` |
| MSFT | `0xaa58516F7f20559024fFB38dacc9A0e157FA045b` | `0xD76742de8cbB9573cdE044a44Bcc27ACE808aAd1` | `0x28148B3c246dDF7728D24ad77eeeD9E06D9433aE` | `0xA817065c647dF183Aa68B4B10cA1FdeB95F6e5b9` |
| GOOGL | `0xD379BF7b360d37B7106b9bB4B7F36E434fDa3cA8` | `0xEc37876062d07085FdF2E1a567CcfBe4526AcE2d` | `0x7A7b8a593765a04e22206aFE0FF05267d6455961` | `0xdf21515D4D96570Cac2bB84850a5e66Bb3b6d55A` |
| META | `0xc63B4bdea064D7f7853CE027C0345bf3db40fCf9` | `0x8Aa81Ab54c1c8de0fFB684E0E0c3aC2e3B0b15e4` | `0x937dE4188DD2a0Ee0aa84d0cc684b02103E0cC3E` | `0x1dEEFd915C5D4020DF485C86cA0d97c2ca9b37B2` |
| GME | `0x61D8c18D76B04F2136Bf2788652745221Ee3Da1E` | `0x3821493B6Ed68FaCf39B8A0ba77DCA45cA9A5A7C` | `0x31F9DD85BE74b5FdD8A3d0081E4aC31E82257523` | `0xCf0090a6bBbF1484d37a1F89CC9f735E8A02efa1` |
| COIN | `0xcf6dC9E428d45224E109017774c9EfE63Dbfdd12` | `0xCdb6Acf9Bbe5b7A43831b5F37B3f38277a942250` | `0x4F04608Dc341790E8a633dAB9009d997b7213F80` | `0x75D84157282C2c490FA45EdF408644ECDf3820bA` |
| MSTR | `0xeCD4c200F69D6797bacebf7CD753CDd4Fb6D675a` | `0x7b2Ba34f85E3833D7ae6Dd14428f3b3c598D307D` | `0x54c912177bF799b15eeb61cE91D7f49571996eaA` | `0xd51b90be578303aA166FD8f7F422671c5f6ee48a` |
| AMD | `0x71178BAc73cBeb415514eB542a8995b82669778d` | `0x3d5109C1DE099FE0a860B05061C702cb57cB7641` | `0x4417b5d480b4f55E443e6393914c4532Dd39A50f` | `0x124aE929734d2c5F8Cf3355128a0d4473e7b4F76` |
| AMZN | `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02` | `0x01379341c1e789BFEf35c4f24C5Fcb8E02C586F5` | `0xc713f39DACd20CBb4D28E119E7f8719a97215d4d` | `0x7d7cAa80Aede74b474A64079914a106240f3Cf13` |
| NFLX | `0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93` | `0x8A4C517645E0A3CE3fF4EBA24DbEACB9f560a315` | `0x8D8d6de4Ab504393570438Fd60AaE802E114Bd3B` | `0x6951c4206FAAD6e497F2Ab8BF08F8A6830C48d6E` |
| PLTR | `0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0` | `0x69a4BcE115b3587B71B5461B3c7209FA8718eD21` | `0xFDd5ef15Df438F0BC185a315A7390d290d85AEfE` | `0xaf76839d832f7E95423dd004352BBa3431125537` |
| TSLA | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` | `0xCE02fB10cE315f19f2E6ED417C2C383A51776e92` | `0x04a296C95c97d45B6176Fb8e0a0d665042f262aC` | `0x24501b388307bD8503d02E8E434fA3BaB83EA18E` |

## Arbitrum Sepolia (421614), deployed 2026-10-02

Mirror of the Robinhood testnet stack with the nine mock markets (the faucet Stock Tokens only exist on Robinhood Chain). The Controller runs on the Solidity oracle router and RiskMathRef here: the public Arbitrum Sepolia RPCs (official, publicnode, dRPC) reject the simulated activation call `cargo stylus` needs, so the Stylus contracts wait for an RPC with state override support (an Alchemy or Infura key). Deployer and owner `0x610FdB41DA83138615C317c89fd9EB09271a46fe`, keeper `0x319a9B7EA619Dd52c799209c111A5c348c9a3957`, Blockscout verified three contracts and then rate-limited the rest ("Too many requests"); re-run `forge verify-contract --verifier blockscout --verifier-url https://arbitrum-sepolia.blockscout.com/api/` in slow batches for the others. Deployment block 315039952.

| Contract | Address |
|---|---|
| MockUSDG (collateral, faucet) | `0x7b6F310e56a6D52DD1C5ffF857bBC9C3dE7F80CE` |
| Controller | `0x6c79924FC12d4645EFCB337Ab07D76783F7555c2` |
| OracleRouter (Solidity, live) | `0x69A5adcfBCe0D9a5509ca9320E91EA33a897d056` |
| RiskMathRef (live) | `0xcc5eb30C661C64B25F0F157f57B8fA44450D49Ba` |
| MarketCalendar (Solidity) | `0xd60Ca0db668a36962EC30e71d13A597683AEa19B` |
| ShortRouter | `0x6081650D5e5791f3747bf934F287b83d694224b0` |
| Liquidator | `0x328dDA4319d78e3d7E52B9cab20D474eE3D74c75` |
| Uniswap v3 factory | `0x2f2208b7Ce0E6d51971dE45f0A70689B106bF574` |
| Uniswap v3 SwapRouter | `0x8Beae8eDD52C508D832d349a50E86B7790Fcefc9` |
| LiquiditySeeder | `0xFBe11448b467e397c57B229E7Ada487A3859042e` |
| Sequencer feed (mock) | `0xc38af15c3555AD2dDDA3De50b6A797efaae5146d` |
| USDG/USD feed (mock, mirrored) | `0xDcaa9BcbE1cd402074Ff80642f3aDF23aF2d7f9e` |

| Ticker | Token | Lending pool | Feed (mock, mirrored) | Uniswap v3 pool |
|---|---|---|---|---|
| NVDA | `0xe0ECD5513baeaff8444c9690C6d845f73EE8370d` | `0x965745066f15A0aeaFC42b291433B6362c9c0B97` | `0xC0f68863bDF21A87fEE287fa082a0Bf269e84E4A` | `0x57637294A8E6E4f2E231ba3F3B05997097bA059a` |
| SPY | `0x4AC34ADB84aaE91D9dEBFB2cD60F7B959F3dFf01` | `0xad7baF95878D335323A9E666F44bDa48F1D0846C` | `0xb3dc16F6F61a0cbB14EB9a8e5dd19FC74cC3f338` | `0x24fC6Ca9F20e7681eE2dDcB248bE7359a0dD2e41` |
| AAPL | `0xbf4D2f3731258ba4EFC72Ad1e5081A8c574b7439` | `0x793F4046C51F18f1978BD509E794e30825D31334` | `0xeC602a39dc73F490034dF850dbB2510772425fFD` | `0xEAAfF1fd39B5daB5EeD234cCb2A70A5095984C56` |
| MSFT | `0xec1ABb1fda29b23b78696074025446aC5F20D2FF` | `0x674417cf60251EFCbFDB09A790127d2F6543C284` | `0x21479E0BF906BEdde693a67dbDCF772C8d5b7A36` | `0x9e6227A53e3A9F44F627fC9359F0Cc2201B91561` |
| GOOGL | `0x85f140298f5d5F62A889a6A69d609e98ACB96060` | `0xf6F49b3D7940af9C2a757FeF789C84b756488f7C` | `0xfCDa641c06Db58770DB0CBfd186A4ab9D71Cd387` | `0xb959d8a51b137126418F2BBEE5c7658c00ce73d8` |
| META | `0x22305F509a86826D1D6183A25Be9b618f6F33611` | `0x1CCbbc30aD26D481816BEfF4d194d134Cd353a2B` | `0xd4F340526B95dE9F12d48E5165C9C3fa8a53eF7d` | `0xAd4064040CB62426C099C94d004706C6Fbb0b541` |
| GME | `0x517D941354B2773852ba4aEb3b6d3bAF600EC415` | `0x45df8Dc662f077B5FC0bb79869a90e22931c99a0` | `0xC1EF6A0B2cd377CcC297137c7c7c866dfdcb182D` | `0x91619735469340561b2dAff5fa4586AF2EAD5161` |
| COIN | `0xC474ee853c670ceed78F782D0BB8AedabF464f4a` | `0x8B13487833c166d2bb318cec8a0771E882f67616` | `0xEDC25367AF422414cD79CF1f4AF79c3B3b373640` | `0xd0d5Bf1154680905c0B739Fdb050752cabDED824` |
| MSTR | `0x4A529e4cE2624c722ACAB1d7d1106397C3daccc6` | `0xD17B058649f3aa92b3ea91280C2BCAEA40b63cD7` | `0x8AFb6342DCc92568CeCAf4F2E38D20a7E87b0e4B` | `0x88F054cB9F2de5bc3bc096330A75Ac9FDFc9F837` |
