/**
 * Add a TTL index on the backup collection so documents expire after 6 months.
 * Uses the `backed` field (set by backup_entity in common/mongodb_functions.js).
 *
 * Usage: node agentic/add_backup_ttl_index.js
 */

const { MongoClient } = require("mongodb");
const keys = require("../secretsandconfig/keys");

const SIX_MONTHS_SECONDS = 6 * 30 * 24 * 60 * 60; // ~180 days

async function main() {
	const client = new MongoClient(keys.mongodb_uri, { ...keys.mongodb_config, serverSelectionTimeoutMS: 10000 });
	try {
		await client.connect();
		const db = client.db(keys.mongodb_name);
		const collection = db.collection("backup");

		// Check existing indexes
		const indexes = await collection.indexes();
		const existing = indexes.find((idx) => idx.key && idx.key.backed !== undefined);
		if (existing) {
			console.log("Existing TTL index on 'backed':", JSON.stringify(existing));
			if (existing.expireAfterSeconds === SIX_MONTHS_SECONDS) {
				console.log("Already set to 6 months. Nothing to do.");
				return;
			}
			console.log("Dropping existing index to recreate with correct expiry...");
			await collection.dropIndex(existing.name);
		}

		await collection.createIndex({ backed: 1 }, { expireAfterSeconds: SIX_MONTHS_SECONDS });
		console.log("Created TTL index on 'backed' with expiry:", SIX_MONTHS_SECONDS, "seconds (~6 months)");

		// Show current backup count
		const count = await collection.countDocuments();
		console.log("Current backup count:", count);
	} finally {
		await client.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
