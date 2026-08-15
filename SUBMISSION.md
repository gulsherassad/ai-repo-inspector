# Submission

## What did you investigate first, and why?
I started with the validation feature. The purpose of this tool is to run checks and report their results, so I first ran a passing command using --validate "npm test" to see the normal output. After that, I deliberately ran a failing one to test the case that actually matters and how it handles failures using --validate "exit 1". This is where the biggest bug showed up, the tool did not record the failed check and the tool ended up crashing with a fatal error and wrote no report at all. This left the previous run's stale report in place. I investigated the failure path first because a review tool that can't handle a failing check is broken at its core.

## What did you choose to implement or fix?
I implemented 3 focused fixes. First, the validation now captures a failed command as a result with pass/fail status and exit code, and the review continues instead of the whole tool crashing on the first failure. Second, I fixed the MCP contract. The schema declared one field name while the handler read another, so the repo path always arrived as undefined. I ended up aligning both on a typed, single-source-of-truth zod schema using consistent repositoryPath naming. This was done so any future drift between schema and handler surfaces as a compile time error instead of undefined. Third, I removed validationCommands from MCP so that AI agents can't trigger arbitrary shell commands through the MCP interface, while keeping validation available through the CLI. 

## What did you intentionally not do?
My goal was to focus on the highest impact problems because of the 90 minute limit. I mainly focused on the validation crash and the MCP contract and safety issues, and intentionally left a few lesser impact things I found but decided not to fix. The first is that the git module always diffs against a branch called main, so it would break on a repo that uses master or has no commits yet. It is a real bug, but it is lower impact than the crash. Fixing it properly means finding the default branch, which would need its own testing. The second is in the CLI, where the repo path is cut short at the first space because the flag handler uses split on a space and takes the first element, so any path containing a space is cut short. I found this by reading the source and left it as a lower priority correctness issue. The third is that the format flag accepts json but is ignored. The value is parsed and passed through, but the report module only ever produces markdown, so the tool silently outputs markdown regardless of what is requested. The fourth is that the report wraps validation output in a block without escaping it, so if a command's output contains backticks, it can break the report's formatting. Finally, there is one main thing I wanted to scope out rather than treat as bugs. I verified the MCP fix through typecheck and code review but did not run it against a live MCP client, which I would want to do before shipping. 

## Interface decision

- Decision: CLI-first 

- Primary user and execution environment: The primary user is a developer that is running a tool locally or in CI, where they explicily control the repo and the validation commands. MCP remains a secondary interface for AI agents, it is deliberately narrowed down to inspecting and reporting only, because I removed its ability to run arbitrary validation commands. 

- Trust boundary and allowed capabilities: The CLI caller is a trusted developer on their own machine so allowing arbitrary commands is acceptable and appropriate because they could run these commands directly anyway. The MCP caller may be an AI agent acting on unverified input, so exposing arbitrary commands and execution would hand an untrusted caller a dangerous capability. Because of this difference, the CLI keeps full validation while the MCP interface is limited to inspection and reporting.

- Reliability, discoverability, latency/context, and output tradeoffs: Reliability improved because a single failing validation no longer aborts the whole run, so a CLI run now completes and produces a report even when checks fail. Discoverability comes from the CLI's usage output and flags, and from the MCP tool's typed schema, which I fixed so it now accurately advertises its inputs. For MCP specifically, latency and context are a tradeoff, since the full report is passed back into an agent's context and a large diff or long validation output can consume significant context. Output size is unbounded in the current report, which is acceptable when writing to a file from the CLI but is a real constraint for MCP. I noted this as a limitation rather than fixing it in the time available.

- How supported interfaces remain consistent: Both interfaces call the same core reviewRepository function, so inspection and report generation behave identically regardless of entry point. I aligned the naming on repositoryPath across the core and the MCP schema so the programmatic contract is consistent, and left the CLI's shorter --repo flag as a convenient alias. The two only diverge where the trust boundary actually calls for it. Only the CLI can run validation and MCP can't.

- Evidence that would change this decision: If the tool turned out to be used mostly by AI agents in sandboxed, throwaway environments where running arbitrary commands isn't really a risk, then an MCP-first design with validation enabled could make sense. And if there was real demand for agents to run validation, I'd come back to it with something safe like an allowed list of specific commands, rather than opening it up to arbitrary shell execution.

## How did you use an AI coding agent?
I used Claude to investigate the repository, identify and scope potential issues, and then plan the fixes. I then used Claude Code to implement each fix separately, reviewing the changes and verifying them with typechecking and tests before accepting the changes. I kept the AI work focused to one fix per prompt so I could understand, review and verify each change rather than accepting a large set of changes blindly. 

## Where did you check, correct, or reject an AI suggestion? (required)
I checked Claude Code's validation fix instead of accepting it without verification. It used typeof error.code === "number" to distinguish a command that ran and failed from one that could not be executed. I tested both exit 1 and definitly-not-a-real-command. The first one behaved as expected, but the second was also treated as a normal failed validation, because exec uses a shell, which returned an exit code when it could not find the command. This showed that the AI's logic was reasonable in theory but incomplete in practice. The missing command still looks like a normal failure because of how the shell reports it. Rather than rushing a fix in the time that I had, I documented this as a known limitation of the validation. I also reviewed Claude Code's MCP fix, which used a single source of truth for the Zod schema and TypeScript type. I accepted the approach after verifying that it kept the schema and handler type schronized and reduces the chance of another naming mismatch. 

## Commands used to verify the result, with outcomes
I verified the changes using typechecking, automated tests, and manual CLI runs covering both successful and failing validation commands. 
npm run typecheck : It passed cleanly after the fixes
npm test : 1 test passed 
npm run inspector -- review --repo . --validate "npm test" : The validation completed successfully and was included in the report. 
npm run inspector -- review --repo . --validate "exit 1" : It initially caused a fatal error. After the fix, the report was generated with a failed status (exit 1).
npm run inspector -- review --repo . --validate "definitely-not-a-real-command" : It captured as a failed validation with exit code 127, and this revealed the shell behaviour limitation. 

## A blocker you hit and how you approached it
While verifying the validation fix, I ran into an unexpected case where the definitely-not-a-real-command was reported as a normal failed validation rather than as an execution error, which is what I had expected for a command that can't run at all. To understand why, I looked into how Node's exec handles commands and found that it runs them through a shell, and the shell itself returns the exit code 127 when it can't find a command. Because this is a real exit code, the implementation treated it the same as a command that ran and failed. Identifying this root cause is what led me to document the behaviour as a known limitation rather than assume the fix already covered every case. 

## Known limitations and the next three things you would do
The known limitations include thin test coverage, since the git and validation modules still have no direct tests, along with the dependency audit findings and some additional reliability and output size improvements that were outside the scope I chose to focus on. The validation path also still treats exit code 127 as a normal failed validation, so a missing command is not distinguished from a command that actually ran and failed. The next three things I would do are, first, handle exit code 127 separately, so that missing commands are clearly reported as execution errors rather than normal validation failures. Second, update git.ts to detect the repository's default branch instead of assuming it is main. Third, I would bound the report output size and escape backticks in validation output, to prevent malformed Markdown and excessive MCP context usage.

## Approximate focused-work time

- Start: 9:10 AM GST (Muscat Time) 
- Finish: 10:38 AM GST (Muscat Time)
