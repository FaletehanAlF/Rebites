---
name: git-commit
description: Commit changes to git using the project's commit message convention (type + Indonesian description). Use this skill every time you finish adding a feature, fixing a bug, restyling UI, updating docs, or refactoring code, even if the user does not say "commit". Also use it whenever the user asks to commit, save changes, or write a commit message.
---

# Git Commit

Every finished change gets its own commit, written in the project's required format so the history stays easy to read (Conventional Commits style).

## Message format

```
<type>: <deskripsi dalam bahasa Indonesia>
```

The description is written in **Indonesian**, starts with a lowercase verb, is specific about what changed, and has no trailing period. Keep the whole line under about 72 characters.

| Type       | Use when                                          | Example                                                |
| ---------- | ------------------------------------------------- | ------------------------------------------------------ |
| `feat`     | Adding a new feature                              | `feat: menambahkan fitur pencarian buku berdasarkan judul` |
| `fix`      | Fixing a bug                                      | `fix: memperbaiki validasi email pada form registrasi` |
| `style`    | Visual or formatting changes, no logic change     | `style: mengubah spacing dan alignment pada navbar`    |
| `docs`     | Documentation only                                | `docs: memperbarui README dengan panduan instalasi`    |
| `refactor` | Restructuring code without changing its behavior  | `refactor: menyederhanakan fungsi untuk menghitung total harga` |

Use only these five types. Do not add a scope such as `feat(search):`.

## Forbidden messages

Vague messages make the history useless, so never use messages like these:

- `update`
- `fix bug`
- `asdf`
- `revisi lagi`

Also avoid other empty variants (`perbaikan`, `changes`, `wip`, `tes`). The description must say *what* changed and *where*. If you can't say that, look at the diff again before committing.

## Workflow

1. **Inspect the changes.** Run `git status` and `git diff` (use `git diff --staged` if files are already staged). Confirm you are inside a git repository; if not, tell the user instead of running `git init`.
2. **Split by purpose.** One commit should hold one logical change. If the diff mixes types (for example a new feature plus a README update), make separate commits, staging only the relevant files for each with `git add <file>`.
3. **Pick the type** from the table above based on what the change actually does. If a change fits two types, prefer the one describing the main purpose, or split it.
4. **Write the message** in the format above, describing the specific change.
5. **Commit** with `git commit -m "<type>: <deskripsi>"`.
6. **Verify** with `git log -1 --oneline` and check that the message reads correctly.

## Rules

- Stage files explicitly. Avoid `git add .` or `git add -A` unless every changed file belongs in this commit.
- Never commit secrets or generated files (`.env`, credentials, `node_modules`, build output). If you see them in the diff, leave them out and mention it to the user.
- Do not push, amend, rebase, or force anything unless the user asks.
- If the commit is rejected (for example by a hook), fix the cause and create a new commit rather than bypassing the hook with `--no-verify`.
- After committing, tell the user the final commit message in one line.