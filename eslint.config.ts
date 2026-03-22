import {defineConfig} from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import gitignoreConfig from "eslint-config-flat-gitignore";

export default defineConfig([
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ["**/*.json"],
		plugins: {json},
		language: "json/json",
		extends: ["json/recommended"],
	},
	{
		files: ["**/*.md"],
		plugins: {markdown},
		language: "markdown/gfm",
		extends: ["markdown/recommended"],
	},
	{
		files: ["**/*.css"],
		plugins: {css},
		language: "css/css",
		extends: ["css/recommended"],
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.ts", "vite.config.ts"],
				},
			},
		},
	},
	gitignoreConfig(),
]);
