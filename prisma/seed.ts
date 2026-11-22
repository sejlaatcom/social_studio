import { ensureCatalog } from "../lib/tenancy";
import { db } from "../lib/db";

// Seeds only the system catalog (permissions + plans). No demo/fake business data.
ensureCatalog().then(async () => { console.log("Catalog seeded (permissions, plans)."); await db.$disconnect(); });
