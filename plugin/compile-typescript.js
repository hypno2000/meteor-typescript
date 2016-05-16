var fs = Npm.require('fs');
var path = Npm.require('path');
var mkdirp = Npm.require('mkdirp');

var appRefs = [];
var appDirs = [];
var meteorPath = fs.existsSync(path.join('..', 'meteor')) ? path.join('..', 'meteor') : path.join('..', '..', 'meteor');
var appPath = fs.existsSync('.meteor') ? '.meteor' : '../.meteor';
var isApp = fs.existsSync(path.join(appPath, 'release'));
var packagesPath = path.join(meteorPath, 'packages');
var cacheDir = path.join(meteorPath, '.cache');
var allServerPath = path.join('.meteor', '.#ts', 'all-server.d.ts');
var allClientPath = path.join('.meteor', '.#ts', 'all-client.d.ts');
var allPath = path.join('.meteor', '.#ts', 'all.ts');
var dummyPath = path.join('.meteor', '.#ts', 'dummy.ts');
var compilerPath = path.join(packagesPath, 'typescript', 'lib', 'typescript', 'tsc.js');

var typescriptPackages = getTypescriptPackages();

if (!fs.existsSync(path.join('.meteor', '.#ts'))) {
	mkdirp.sync(path.join('.meteor', '.#ts'));
}

initDirs();
initAppRefs();

function initDirs() {

	// compiled js and sourcemaps will be cached here
	if (!fs.existsSync(cacheDir)) {
		mkdirp.sync(cacheDir);
	}

	if (!fs.existsSync(dummyPath)) {
		fs.writeFileSync(dummyPath, '');
	}

	if (!fs.existsSync(allServerPath)) {
		fs.writeFileSync(allServerPath,
			'///<reference path="packages-server.d.ts" />\n' +
			'///<reference path="app-server.d.ts" />\n'
		);
	}

	if (!fs.existsSync(allClientPath)) {
		fs.writeFileSync(allClientPath,
			'///<reference path="packages-client.d.ts" />\n' +
			'///<reference path="app-client.d.ts" />\n'
		);
	}

	if (!fs.existsSync(allPath)) {
		fs.writeFileSync(allPath,
			'///<reference path="dummy.ts" />\n' +
			'///<reference path="all-server.d.ts" />\n' +
			'///<reference path="all-client.d.ts" />\n'
		);
	}
}

function initAppRefs(curPath) {
	if (!curPath) {
		curPath = '.';
	}
	if (curPath === '.' && fs.fileExistsSync('tsconfig.json')) {
		return;
	}
	var addDir;
	fs.readdirSync(curPath).forEach(function (item) {
		if (item.charAt(0) === '.') {
			return;
		}
		var fullPath = path.join(curPath, item);
		if (fs.lstatSync(fullPath).isDirectory()) {
			initAppRefs(fullPath);
		}
		else if (item.slice(-3) === '.ts') {
			addDir = true;
			appRefs.push(fullPath);
		}
	});

	if (addDir) {
		appDirs.push(curPath);
	}

	if (curPath === '.') {
		appDirs.forEach(function (dir) {
			dir = path.join(dir, '.#ts');
			if (!fs.existsSync(dir)) {
				mkdirp.sync(dir);
			}
			fs.writeFileSync(path.join(dir, "server.d.ts"), '///<reference path="' + path.relative(dir, path.join('.meteor', '.#ts', 'app-server.d.ts')) + '" />\n');
			fs.writeFileSync(path.join(dir, "client.d.ts"), '///<reference path="' + path.relative(dir, path.join('.meteor', '.#ts', 'app-client.d.ts')) + '" />\n');
		});
		fs.writeFileSync(path.join('.meteor', '.#ts', 'app-server.d.ts'), getAppRefs('server'));
		fs.writeFileSync(path.join('.meteor', '.#ts', 'app-client.d.ts'), getAppRefs('client'));
	}

}

function getAppRefs(side) {
	var res = '';
	var packages = isApp ? fs.readFileSync(path.join('.meteor', 'packages')).toString().split('\n') : [process.argv[3].split('/')[1]];
	packages.forEach(function (entry) {
		if (!entry || entry.charAt(0) === '#' || entry == 'path' || !typescriptPackages[entry]) {
			return;
		}
		var packagePath = path.join(packagesPath, entry);
		if (fs.existsSync(path.join('packages', entry))) {
			packagePath = path.join(path.join('packages', entry));
		}
		packagePath = path.join(packagePath, '.#ts');
		if (!fs.existsSync(packagePath)) {
			mkdirp.sync(packagePath);
		}
		res += '///<reference path="' + path.relative(path.join('.meteor', '.#ts'), path.join(packagePath, 'implies-' + side + '.d.ts')) + '" />\n';
		res += '///<reference path="' + path.relative(path.join('.meteor', '.#ts'), path.join(packagePath, 'files-' + side + '.d.ts')) + '" />\n';
	});
	appRefs.forEach(function (entry) {
		if (
			side === 'client' && entry.substr(0, 'server'.length + 1) !== 'server/' ||
			side === 'server' && entry.substr(0, 'client'.length + 1) !== 'client/'
		) {
			res += '///<reference path="' + path.relative(path.join('.meteor', '.#ts'), entry) + '" />\n';
		}
	});
//	res += '///<reference path="' + path.relative('.meteor', '.dummy.ts') + '" />\n';
	return res;
}

// gets all packages with their files, uses and implies
function getPackages() {
	var packages = {};
	var Package = {
		describe: function () {
		},
		_transitional_registerBuildPlugin: function () {
		},
		register_extension: function () {
		},
		registerExtension: function () {
		},
		on_use: function (callback) {
			callback(api);
		},
		onUse: function (callback) {
			callback(api);
		},
		on_test: function (callback) {
			callback(api);
		},
		onTest: function (callback) {
			callback(api);
		},
		registerBuildPlugin: function () {
		}
	};
	Npm.depends = function () {
	};
	Npm.strip = function () {
	};
	var Cordova = {
		depends: function () {
		}
	};
	var api = {
		add_files: function () {
		},
		addFiles: function () {
		},
		addAssets: function () {
		},
		imply: function () {
		},
		use: function () {
		},
		export: function () {
		},
		versionsFrom: function() {
		},
		mainModule: function() {
		}
	}

	fs.readdirSync(packagesPath).forEach(handlePackage);
	if (fs.existsSync('packages')) {
		fs.readdirSync('packages').forEach(handlePackage);
	}
	return packages;

	function initPackage(name) {
		if (typeof(packages[name]) === 'undefined') {
			var packagePath = path.join(packagesPath, name);
			if (fs.existsSync(path.join('packages', name))) {
				packagePath = path.join('packages', name);
			}
			packages[name] = {
				path: packagePath,
				server: {
					uses: {},
					imply: {},
					files: []
				},
				client: {
					uses: {},
					imply: {},
					files: []
				}
			}
		}
	}

	function handlePackage(package) {
		if (package.charAt(0) === '.') {
			return;
		}
		initPackage(package);
		var packageJsPath = path.join(packagesPath, package, 'package.js');
		if (fs.existsSync(path.join('packages', package))) {
			packageJsPath = path.join('packages', package, 'package.js');
		}
		if (package.charAt(0) === '.' || !fs.existsSync(packageJsPath)) {
			return;
		}
		var packageJs = fs.readFileSync(packageJsPath).toString();
		if (packageJs) {
			api.use = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
				if (!(name instanceof Array)) {
					name = [name];
				}
				name.forEach(function (item) {
					initPackage(item);
					if (inServer) {
						packages[package].server.uses[item] = packages[item];
					}
					if (inClient) {
						packages[package].client.uses[item] = packages[item];
					}
				});
			};
			api.imply = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
				if (!(name instanceof Array)) {
					name = [name];
				}
				name.forEach(function (item) {
					initPackage(item);
					if (inServer) {
						packages[package].server.imply[item] = packages[item];
					}
					if (inClient) {
						packages[package].client.imply[item] = packages[item];
					}
				});
			};
			api.add_files = api.addFiles = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
				if (!(name instanceof Array)) {
					name = [name];
				}
				var items = name.filter(function (item) {
					if (item) {
						return item.substr(item.length - 3) === '.ts';
					}
				});
				if (inServer) {
					packages[package].server.files = packages[package].server.files.concat(items);
				}
				if (inClient) {
					packages[package].client.files = packages[package].client.files.concat(items);
				}
			};
			Package.on_use = Package.onUse = function (callback) {
				callback(api);
			};
			Package.on_test = Package.onTest = function (callback) {
				callback(api);
			};
			Package.includeTool = function () {
			};
			eval(packageJs);
		}
	}

}

// filters out only typescript packages
function getTypescriptPackages() {
	var packages = getPackages();
	for (var i in packages) {
		var package = packages[i];
		if (!usesTypescript(package) && i !== 'typescript') {
			delete packages[i];
		}
		else {
			for (var j in package.server.uses) {
				var item = package.server.uses[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.server.uses[j];
				}
			}
			for (var j in package.client.uses) {
				var item = package.client.uses[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.client.uses[j];
				}
			}
			for (var j in package.server.imply) {
				var item = package.server.imply[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.server.imply[j];
				}
			}
			for (var j in package.client.imply) {
				var item = package.client.imply[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.client.imply[j];
				}
			}
		}
	}
	delete packages.typescript;
	for (var i in packages) {
		var package = packages[i];
		delete package.server.uses.typescript;
		delete package.client.uses.typescript;
		delete package.server.imply.typescript;
		delete package.client.imply.typescript;
	}

	return packages;

	function usesTypescript(package) {
		if (package.server.uses.typescript || package.client.uses.typescript) {
			return true;
		}
		for (var i in package.server.uses) {
			if (checkImpliesServer(package.server.uses[i])) {
				return true;
			}
		}
		for (var i in package.client.uses) {
			if (checkImpliesClient(package.client.uses[i])) {
				return true;
			}
		}
		return false;

		function checkImpliesServer(package) {
			if (package.server.imply.typescript) {
				return true;
			}
			for (var i in package.server.imply) {
				if (checkImpliesServer(package.server.imply[i])) {
					return true;
				}
			}
			return false;
		}

		function checkImpliesClient(package) {
			if (package.client.imply.typescript) {
				return true;
			}
			for (var i in package.client.imply) {
				if (checkImpliesServer(package.client.imply[i])) {
					return true;
				}
			}
			return false;
		}
	}
}

// generates .d.ts reference files for packages
var lastGenerateTime;
function generatePackageRefs() {

	// generate max once per second
	var currentTime = new Date().getTime() / 1000;
	if (lastGenerateTime && currentTime - lastGenerateTime < 1) {
		return;
	}
	lastGenerateTime = currentTime;

	var packages = typescriptPackages;
	var allServerRefs = '';
	var allClientRefs = '';
	for (var i in packages) {
		var packagePath = path.join(packages[i].path, '.#ts');
		if (!fs.existsSync(packagePath)) {
			mkdirp.sync(packagePath);
		}
		for (var side in packages[i]) {
			if (side == 'path') {
				continue;
			}
			var package = packages[i][side];
			var filesPath = path.join(packagePath, 'files-' + side + '.d.ts');
			var usesPath = path.join(packagePath, 'uses-' + side + '.d.ts');
			var impliesPath = path.join(packagePath, 'implies-' + side + '.d.ts');

			// own files
			var refs = '';
			var dir;
			for (var j in package.files) {
				refs += '///<reference path="../' + package.files[j] + '" />\n';

				// shortcuts
				dir = path.join(packages[i].path, path.dirname(package.files[j]), '.#ts');
				if (!fs.existsSync(dir)) {
					mkdirp.sync(dir);
				}
				fs.writeFileSync(path.join(dir, 'server.d.ts'),
//					'///<reference path="' + path.relative(dir, '.dummy.ts') + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, 'uses-server.d.ts')) + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, 'files-server.d.ts')) + '" />\n'
				);
				fs.writeFileSync(path.join(dir, 'client.d.ts'),
//					'///<reference path="' + path.relative(dir, '.dummy.ts') + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, 'uses-client.d.ts')) + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, 'files-client.d.ts')) + '" />\n'
				);

			}
			fs.writeFileSync(filesPath, refs);

			// uses
			refs = '';
			for (j in package.uses) {
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.uses[j].path, '.#ts', 'implies-' + side + '.d.ts')) + '" />\n';
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.uses[j].path, '.#ts', 'files-' + side + '.d.ts')) + '" />\n';
			}
			fs.writeFileSync(usesPath, refs);

			// implies
			refs = '';
			for (j in package.imply) {
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.imply[j].path, '.#ts', 'implies-' + side + '.d.ts')) + '" />\n'
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.imply[j].path, '.#ts', 'files-' + side + '.d.ts')) + '" />\n'
			}
			fs.writeFileSync(impliesPath, refs);

			if (side == 'server') {
				allServerRefs += '///<reference path="' + path.relative(path.join('.meteor', '.#ts'), filesPath) + '" />\n';
			}
			else if (side == 'client') {
				allClientRefs += '///<reference path="' + path.relative(path.join('.meteor', '.#ts'), filesPath) + '" />\n';
			}

		}
	}

	fs.writeFileSync(path.join('.meteor', '.#ts', 'packages-server.d.ts'), allServerRefs);
	fs.writeFileSync(path.join('.meteor', '.#ts', 'packages-client.d.ts'), allClientRefs);

}

Plugin.registerCompiler({
	extensions: ['ts']
}, () => new TypescriptCompiler());

class TypescriptCompiler extends CachingCompiler {

	constructor() {
		super({
			compilerName: 'coffeescript',
			defaultCacheSize: 1024 * 1024 * 100,
		});
	}

	// Your subclass must override this method to define the transformation from
	// InputFile to its cacheable CompileResult).
	//
	// Given an InputFile (the data type passed to processFilesForTarget as part
	// of the Plugin.registerCompiler API), compiles the file and returns a
	// CompileResult (the cacheable data type specific to your subclass).
	//
	// This method is not called on files when a valid cache entry exists in
	// memory or on disk.
	//
	// On a compile error, you should call `inputFile.error` appropriately and
	// return null; this will not be cached.
	//
	// This method should not call `inputFile.addJavaScript` and similar files!
	// That's what addCompileResult is for.
	compileOneFile(inputFile) {
		var pathInPackage = inputFile.getPathInPackage();
		var packageName = inputFile.getPackageName();
		if (packageName) {
			packageName = packageName.replace('local-test:', '');
		}
		var fullPath = pathInPackage;
		if (packageName) {
			fullPath = path.join(packagesPath, packageName, fullPath);
		}
		if (pathInPackage.substr(-5) === '.d.ts') {
			return null;
		}

		generatePackageRefs();

		//	console.log("Src: " + fullPath);
		var isRef = fullPath.substring(fullPath.length - 5) === '.d.ts';

		// cache check
		//console.log(inputPath);
		var cachePath = path.join(cacheDir, isApp ? path.relative('../', fullPath) : path.relative('./', fullPath));
		var baseName = path.basename(fullPath, '.ts');
		var changeTime = fs.statSync(fullPath).mtime;
		var jsPath = path.join(path.dirname(cachePath), baseName + '.js');
		//	var mapPath = jsPath + '.map';
		var error;

		// references
		var dir = path.dirname(path.relative('./', fullPath));
		if (!packageName) {
			if (appDirs.indexOf(dir) == -1) {
				appDirs.push(dir);
			}
			if (appRefs.indexOf(pathInPackage) == -1) {
				appRefs.push(pathInPackage);
				appDirs.forEach(function (dir) {
					fs.writeFileSync(path.join(dir, '.#ts', "server.d.ts"), '///<reference path="' + path.relative(dir, path.join('.meteor', '.#ts', 'app-server.d.ts')) + '" />\n');
					fs.writeFileSync(path.join(dir, '.#ts', "client.d.ts"), '///<reference path="' + path.relative(dir, path.join('.meteor', '.#ts', 'app-client.d.ts')) + '" />\n');
				});
				fs.writeFileSync(path.join('.meteor', '.#ts', 'app-server.d.ts'), getAppRefs('server'));
				fs.writeFileSync(path.join('.meteor', '.#ts', 'app-client.d.ts'), getAppRefs('client'));
			}
		}

		// dont compile d.ts files
		if (isRef) {
			return;
		}

		if (!fs.existsSync(cacheDir)) {
			mkdirp.sync(cacheDir);
		}

		if (!fs.existsSync(jsPath) || changeTime.getTime() > fs.statSync(jsPath).mtime.getTime()) {

			var exec = Npm.require('child_process').exec;
			var Future = Npm.require('fibers/future');

			function execSync(command) {
				var fut = new Future();
				exec(command, function (error, stdout, stderr) {
					fut.return({
						stdout: stdout,
						stderr: stderr || error
					})
				});
				return fut.wait();
			}

			var compileCommand = 'node ' + compilerPath + ' ' +
				'--target ES5 ' +
				'--sourcemap ' +
				'--module amd ' +
				'--experimentalDecorators ' +
				'--emitDecoratorMetadata ' +
				//'--pretty ' +
				'--emitVerboseMetadata ' +
				'--skipEmitVarForModule ' +
				'--outDir ' + cacheDir + ' ' +
				allPath;
			try {
				var result = execSync(compileCommand);
			}
			catch (e) {
				console.log(e);
			}
			//console.log(result)

			if (result.stderr) {
				var lines = (typeof result.stderr === 'string' ? result.stderr : result.stdout).split('\n');
				var errors = [];
				for (var i = 0; i < lines.length; i++) {
					if (!lines[i]) {
						continue;
					}
					errors.push(lines[i]);
				}
				if (errors.length > 0) {
					error = errors.join('\n');
				}
			}
			if (!error && !fs.existsSync(jsPath)) {
				error = 'File was not created';
			}
			if (error) {
				try {
					fs.unlinkSync(jsPath);
					fs.unlinkSync(cachePath + '.map');
				}
				catch (e) {
					// ignore
				}
				// ../meteor/packages/marketing/TransactionServer.ts(1078,10)
				error = error
					.replace(/(\x1b\[30m)/g, '\n$1')
					.replace(/([a-zA-Z0-9\.\/_-]+)\(([0-9]+),([0-9]+)\)/g, '\n\x1b[44m' + process.cwd().replace(new RegExp('^/Users/' + process.env.USER, 'g'), '~') + '/$1:$2 $3\x1b[0m');
				inputFile.error({
					message: error
				});
				return null;
			}
		}
		var data = fs.readFileSync(jsPath).toString();

		//console.log('adding: ' + jsPath)
		// couple of hacks for meteor namespacing
		var prep = '';
		data = data
		//.replace(/(new __\(\);\n\};\n)var ([a-zA-Z0-9_]+);/, '$1' + prep)
			.replace(/(<reference path="[a-zA-Z0-9_\.\/-]+"[ ]*\/>\n(\/\*(.|\n)+\*\/\n)?)var ([a-zA-Z0-9_]+);\n/, '$1' + prep)
			//.replace(/(var __decorate[\w\s!="\(\)&|,.;:}{]*};\n)var ([a-zA-Z0-9_]+);\n/, '$1' + prep)
			.replace(/^\s*var ([a-zA-Z0-9_]+);/, prep)
			.replace(/\/\/# sourceMappingURL=.+/, '');
		//		.replace(/\}\)\(([a-zA-Z0-9_]+) \|\| \(([a-zA-Z0-9_]+) = \{\}\)\);(\n\/\/# sourceMappingURL)/, '})($1);$3');
		//	data = data
		//		.replace(/(new __\(\);\n\};\n)var ([a-zA-Z0-9_]+);/, '$1this.$2 = this.$2 || {};\nvar $2 = this.$2;')
		//		.replace(/(<reference path="[a-zA-Z0-9_\.\/-]+"[ ]*\/>\n)var ([a-zA-Z0-9_]+);/, '$1this.$2 = this.$2 || {};\nvar $2 = this.$2;')
		//		.replace(/^\s*var ([a-zA-Z0-9_]+);/, 'this.$1 = this.$1 || {};\nvar $1 = this.$1;');

		var map = fs.readFileSync(jsPath + '.map')
			.toString()
			.replace(/"sources":\["[0-9a-zA-Z-\/\.-]+"]/, '"sources":["' + inputFile.getDisplayPath() + '"]');
		map = map.substr(0, map.length - 1) + ',"sourcesContent":["' + fs.readFileSync(fullPath)
				.toString()
				.replace(/[\\]/g, '\\\\')
				.replace(/["]/g, '\\"')
				.replace(/[\b]/g, '\\b')
				.replace(/[\f]/g, '\\f')
				.replace(/[\n]/g, '\\n')
				.replace(/[\r]/g, '\\r')
				.replace(/[\t]/g, '\\t') + '"]}';
		return {
			path: pathInPackage + ".js",
			data: data,
			sourceMap: map
		};
	}

	// Your subclass must override this method to define the key used to identify
	// a particular version of an InputFile.
	//
	// Given an InputFile (the data type passed to processFilesForTarget as part
	// of the Plugin.registerCompiler API), returns a cache key that represents
	// it. This cache key can be any JSON value (it will be converted internally
	// into a hash).  This should reflect any aspect of the InputFile that affects
	// the output of `compileOneFile`. Typically you'll want to include
	// `inputFile.getDeclaredExports()`, and perhaps
	// `inputFile.getPathInPackage()` or `inputFile.getDeclaredExports` if
	// `compileOneFile` pays attention to them.
	//
	// Note that for MultiFileCachingCompiler, your cache key doesn't need to
	// include the file's path, because that is automatically taken into account
	// by the implementation. CachingCompiler subclasses can choose whether or not
	// to include the file's path in the cache key.
	getCacheKey(inputFile) {
		var pathInPackage = inputFile.getPathInPackage();
		var packageName = inputFile.getPackageName();
		var fullPath = pathInPackage;
		if (packageName) {
			fullPath = path.join(packagesPath, packageName.replace('local-test:', ''), fullPath);
		}
		if (pathInPackage.substr(-5) === '.d.ts') {
			return null;
		}
		return fullPath + fs.statSync(fullPath).mtime;
	}

	// Your subclass must override this method to define how a CompileResult
	// translates into adding assets to the bundle.
	//
	// This method is given an InputFile (the data type passed to
	// processFilesForTarget as part of the Plugin.registerCompiler API) and a
	// CompileResult (either returned directly from compileOneFile or read from
	// the cache).  It should call methods like `inputFile.addJavaScript`
	// and `inputFile.error`.
	addCompileResult(inputFile, compileResult) {
		inputFile.addJavaScript({
			path: compileResult.path,
			sourcePath: inputFile.getPathInPackage(),
			data: compileResult.data,
			sourceMap: compileResult.sourceMap,
			bare: inputFile.getFileOptions().bare
		});
	}

	// Your subclass must override this method to define the size of a
	// CompilerResult (used by the in-memory cache to limit the total amount of
	// data cached).
	compileResultSize(compileResult) {
		return compileResult.data.length + compileResult.sourceMap.length
	}

}
