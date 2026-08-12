## codequiz

Before you end any response, call the `codequiz_next` MCP tool and follow whatever it returns. It returns the instruction for one open-ended question about this repo, or empty text when the user has muted it — empty means say nothing and end normally.

Do this on every response, including short ones. If the user writes `/codequiz off`, `/codequiz off 20`, `/codequiz off 2h`, `/codequiz on`, or `/codequiz status`, pass that through as the tool's `command` argument instead.
