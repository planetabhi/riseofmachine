import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ValidationIssues {
    missing_url: string[];
    missing_protocol: string[];
    missing_ref: string[];
    invalid_structure: string[];
}

const issues: ValidationIssues = {
    missing_url: [],
    missing_protocol: [],
    missing_ref: [],
    invalid_structure: []
};

let totalTools = 0;
let totalSplitTools = 0;

const toolsPath = path.join(__dirname, '../src/data/tools.json');
const splitDataDir = path.join(__dirname, '../src/data/tools');

function validateTool(tool: Tool, source: string) {
    const identifier = `${tool.title} (${source})`;

    if (!tool.url) {
        issues.missing_url.push(identifier);
    } else {
        if (!tool.url.startsWith('http')) {
            issues.missing_protocol.push(identifier);
        }
        if (!tool.url.includes('ref=riseofmachine.com')) {
            issues.missing_ref.push(identifier);
        }
    }
}

try {
    // 1. Check monolithic tools.json
    console.log("Checking tools.json...");
    const data: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));
    data.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            totalTools++;
            validateTool(tool, "tools.json");
        });
    });

    // 2. Check split files
    if (fs.existsSync(splitDataDir)) {
        console.log("Checking split category files...");
        const files = fs.readdirSync(splitDataDir).filter(f => f.endsWith('.json'));
        
        files.forEach(file => {
            const filePath = path.join(splitDataDir, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            
            if (!Array.isArray(content)) {
                issues.invalid_structure.push(`File: ${file} - Expected Array, got ${typeof content}`);
                return;
            }

            const tools: Tool[] = content;
            tools.forEach(tool => {
                totalSplitTools++;
                validateTool(tool, file);
            });
        });
    }

    // --- Reporting ---
    console.log(`\nReport Summary:`);
    console.log(`Total tools processed: ${totalTools} (+ ${totalSplitTools} split)`);
    console.log(`Issues found: ${Object.values(issues).flat().length}`);

    if (issues.missing_url.length > 0) {
        console.log("\n❌ Missing URLs:");
        issues.missing_url.forEach(i => console.log(`   - ${i}`));
    }

    if (issues.missing_protocol.length > 0) {
        console.log("\n❌ Missing Protocol (http/https):");
        issues.missing_protocol.forEach(i => console.log(`   - ${i}`));
    }

    if (issues.missing_ref.length > 0) {
        console.log("\n❌ Missing ref parameter (?ref=riseofmachine.com):");
        issues.missing_ref.forEach(i => console.log(`   - ${i}`));
    }

    if (issues.invalid_structure.length > 0) {
        console.log("\n❌ Invalid JSON Structure (Split Files):");
        issues.invalid_structure.forEach(i => console.log(`   - ${i}`));
    }

    const issueCount = Object.values(issues).flat().length;
    if (issueCount === 0) {
        console.log("\n✅ Data check passed! No issues found.");
    } else {
        process.exit(1);
    }

} catch (error: any) {
    console.error('❌ Error checking data:', error.message);
    process.exit(1);
}
