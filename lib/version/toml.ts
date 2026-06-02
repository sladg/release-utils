import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'

import { applyStructured } from './structured'

// @NOTE: JS has no format-preserving TOML editor, so Cargo.toml/pyproject.toml
// are re-serialized (comments/layout are not preserved on bump).
export const applyToml = applyStructured(parseToml, (data) =>
  stringifyToml(data),
)
