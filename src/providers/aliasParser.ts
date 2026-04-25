// Parses SQL text and returns a map of alias -> table name/FQN
// Handles:
//   FROM orders o
//   FROM orders AS o
//   JOIN acme_nexus_raw_data.acme_raw.sales.products p
//   JOIN acme_nexus_raw_data.acme_raw.sales.products AS p

export function parseAliases(sql: string): Map<string, string> {
    const aliases = new Map<string, string>();

    // Match: FROM/JOIN <table> [AS] <alias>
    const pattern = /(?:FROM|JOIN)\s+([\w.]+)\s+(?:AS\s+)?(\w+)/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(sql)) !== null) {
        const table = match[1];
        const alias = match[2].toUpperCase();

        // Skip if alias is a SQL keyword (e.g. FROM orders ON ...)
        if (/^(ON|WHERE|SET|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|AS|SELECT|GROUP|ORDER|HAVING|LIMIT|UNION)$/i.test(alias)) {
            continue;
        }

        aliases.set(match[2], table); // preserve original case for alias key
    }

    return aliases;
}
