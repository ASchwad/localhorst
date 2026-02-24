# localhorst

Zero-dependency Bun CLI to list and kill local dev servers on ports 3000–9000.

## Install

```sh
bun install
bun link
```

## Usage

```sh
localhorst              # list all dev servers
localhorst kill 3000    # kill server on port 3000
localhorst kill --all   # kill all dev servers
localhorst kill 3000 -f # force kill (SIGKILL)
```
