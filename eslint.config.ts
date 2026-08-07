import {defineConfig} from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    {
        ignores: ["node_modules", "out", "tests", "eslint.config.ts"],
    },
    {
        plugins: {
            "@typescript-eslint": tseslint.plugin,
        },
        files: ["**/*.ts"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                warnOnUnsupportedTypeScriptVersion: false,
                allowAutomaticSingleRunInference: true,
                project: "tsconfig.json",
            },
        },
        rules: {
            "@typescript-eslint/consistent-indexed-object-style": "error",
            "@typescript-eslint/array-type": "error",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/consistent-type-definitions": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unsafe-function-type": "error",
            "@typescript-eslint/prefer-literal-enum-member": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    varsIgnorePattern: "^_",
                    argsIgnorePattern: "^_"
                },
            ],
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "variable",
                    format: ["camelCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "class",
                    format: ["PascalCase"]
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"],
                },
                {
                    selector: "classProperty",
                    format: ["camelCase", "snake_case"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "typeProperty",
                    format: ["camelCase", "snake_case"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "classMethod",
                    format: ["camelCase", "snake_case"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "objectLiteralProperty",
                    format: ["camelCase", "snake_case", "PascalCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "default",
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "allow",
                }
            ],
            "@typescript-eslint/no-extraneous-class": "off",
            "@typescript-eslint/no-empty-function": "warn",
            "no-var": "error",
            "prefer-const": "error",
            "prefer-arrow-callback": "error",
            "no-nested-ternary": "warn",
            "no-multi-spaces": "error",
            "no-multiple-empty-lines": [
                "error",
                {
                    max: 1
                }
            ],
            "comma-dangle": ["error", "always-multiline"],
            "object-curly-spacing": ["error", "never"],
            "quotes": [
                "error",
                "double",
                {
                    avoidEscape: true
                }
            ],
            "@typescript-eslint/no-empty-object-type": "off",
        },
    },
);
