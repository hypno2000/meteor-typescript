Package.describe({
	summary: "Javascript with Types",
	version: "1.0.0"
});

Package.registerBuildPlugin({
	name: "compileTypescript",
	use: ['caching-compiler', 'ecmascript'],
	sources: ['plugin/compile-typescript.js'],
	npmDependencies: {
		"mkdirp": "0.3.5",
   	"source-map": "0.4.2"
	}
});

Package.onUse(function (api) {
	api.use('isobuild:compiler-plugin@1.0.0');
});