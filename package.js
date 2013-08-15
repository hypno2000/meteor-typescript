Package.describe({
	summary: "Javascript with types"
});

Package._transitional_registerBuildPlugin({
	name: "compileTypescript",
	use: [],
	sources: [
	  'plugin/compile-typescript.js'
	],
	npmDependencies: {
		"exec-sync": "0.1.5",
		"mkdirp": "0.3.5",
		"source-map": "0.1.24"
	}
});