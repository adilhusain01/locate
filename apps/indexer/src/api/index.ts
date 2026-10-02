import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// public borrow-rate feed: every market's latest fee index and credited lender USDG
app.get("/markets", async (c) => {
  const rows = await db.select().from(schema.market);
  return c.json(rows.map((r) => ({ ...r, feeIndex: r.feeIndex.toString(), totalLenderUsdg: r.totalLenderUsdg.toString(), totalInsuranceUsdg: r.totalInsuranceUsdg.toString(), listedAt: r.listedAt.toString() })));
});

export default app;
