export function parseAliases(sql: string): Map<string, string> {
    const aliases = new Map<string, string>();

    // Match: FROM/JOIN <table> [AS] <alias>
    const pattern = /(?:FROM|JOIN)\s+([\w.]+)\s+(?:AS\s+)?(\w+)/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(sql)) !== null) {
        const table = match[1];
        const alias = match[2].toUpperCase();

     
        if (/^(ON|WHERE|SET|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|AS|SELECT|GROUP|ORDER|HAVING|LIMIT|UNION)$/i.test(alias)) {
            continue;
        }

        aliases.set(match[2], table); 
    }

    return aliases;
}
