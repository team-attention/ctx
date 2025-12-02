import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface SessionOptions {
    role?: 'user' | 'assistant';
    format?: 'jsonl' | 'text' | 'markdown';
}

interface CtxCurrent {
    sessions?: string[];
}

interface Message {
    type?: string;
    role?: string;
    message?: {
        role?: string;
        content?: string | any[];
    };
    content?: string | any;
    text?: string;
}

export async function sessionCommand(file: string | undefined, options: SessionOptions) {
    const projectRoot = process.cwd();
    let sessionFiles: string[] = [];

    // 1. Determine session files
    if (file) {
        sessionFiles = [file];
    } else {
        // Try to read from .ctx.current
        try {
            const ctxCurrentPath = path.join(projectRoot, '.ctx.current');
            const content = await fs.readFile(ctxCurrentPath, 'utf-8');
            const ctxCurrent: CtxCurrent = JSON.parse(content);

            if (ctxCurrent.sessions && ctxCurrent.sessions.length > 0) {
                sessionFiles = ctxCurrent.sessions;
            } else {
                console.error(chalk.red('✗ No sessions found in .ctx.current'));
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('✗ Could not read .ctx.current and no file specified'));
            process.exit(1);
        }
    }

    // 2. Process each session file
    for (const sessionFile of sessionFiles) {
        try {
            // Handle both absolute and relative paths
            const filePath = path.isAbsolute(sessionFile)
                ? sessionFile
                : path.join(projectRoot, sessionFile);

            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const msg: Message = JSON.parse(line);

                    // Claude Code session files use 'type' field for role (user/assistant)
                    // Skip metadata entries (file-history-snapshot, system, etc.)
                    const role = msg.type;
                    if (!role || !['user', 'assistant'].includes(role)) {
                        continue;
                    }

                    // Filter by role if specified
                    if (options.role && role !== options.role) {
                        continue;
                    }

                    // Extract content from nested message structure
                    let textContent = '';
                    if (msg.message?.content) {
                        if (typeof msg.message.content === 'string') {
                            textContent = msg.message.content;
                        } else if (Array.isArray(msg.message.content)) {
                            // Handle structured content (e.g. Claude API format)
                            textContent = msg.message.content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text || '')
                                .join('\n');
                        }
                    } else if (typeof msg.content === 'string') {
                        textContent = msg.content;
                    } else if (msg.text) {
                        textContent = msg.text;
                    }

                    // Skip if no text content (e.g., tool_use only messages)
                    if (!textContent.trim()) {
                        continue;
                    }

                    // Output based on format
                    if (options.format === 'text') {
                        console.log(textContent);
                    } else if (options.format === 'markdown') {
                        const roleLabel = role === 'user' ? 'User' : 'Assistant';
                        console.log(`### ${roleLabel}\n\n${textContent}\n`);
                    } else {
                        // Default jsonl - output simplified format
                        console.log(JSON.stringify({ role, content: textContent }));
                    }

                } catch (e) {
                    // Ignore parse errors for individual lines
                }
            }
        } catch (error) {
            console.error(chalk.red(`✗ Error reading session file: ${sessionFile}`));
            // Continue to next file
        }
    }
}