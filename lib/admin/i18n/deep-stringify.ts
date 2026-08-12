/** Same key structure as T, but every leaf widened to `string` — used so a locale's translated text (never the same string literal as the source locale) can still be typed against the source's exact key shape. */
export type DeepStringify<T> = T extends string ? string : { [K in keyof T]: DeepStringify<T[K]> };
