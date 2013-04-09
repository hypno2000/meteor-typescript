/*global Package*/
Package.describe({
	summary: "TypeScript, a typed superset of Javascript that compiles to plain Javascript"
});

Npm.depends({
	"exec-sync": "0.1.5",
	"mkdirp": "0.3.5"
});

Package.register_extension("ts", function (bundle, source_path, serve_path, where) {
	var fs = Npm.require('fs');
	var path = Npm.require('path');
	var mkdirp = Npm.require('mkdirp');

	// cache check
	var cachePath = '.meteor/cache' + serve_path;
	var cacheDir = path.dirname(cachePath);
	var baseName = path.basename(source_path, '.ts');
	var changeTime = fs.statSync(source_path).mtime;
	if (!fs.existsSync(cacheDir)) {
		mkdirp.sync(cacheDir);
	}
	if (!fs.existsSync(cachePath) || changeTime.getTime() > fs.statSync(cachePath).mtime.getTime()) {

		var execSync = Npm.require('exec-sync');

		var ERROR = "\nTypeScript compilation failed!\n";
		ERROR = ERROR + (new Array(ERROR.length - 1).join("-")) + "\n";
		// XXX Use other npm packages. Seen in the handlebars package ;)

		var compileCommand = 'tsc --nolib --sourcemap --out ' + cacheDir + " " + source_path; // add client,server module type switch?
		var result = null;

		// Compile the TypeScript file with the TypeScript command line compiler.
		// Until the TypeScript module provides a public API there is no reliable way around it without changing the
		// TypeScript sources.
		try {
			result = execSync(compileCommand);
		} catch (e) {
			var lines = e.message.split('\n');
			var errors = [];
			for (var i = 0; i < lines.length ; i++) {
				if (
					// !/The property '__super__' does not exist on value of type/.test(lines[i]) &&
					lines[i].substr(-36) !== 'Base type must be interface or class' &&
					lines[i].substr(-30) !== 'not exist in the current scope' &&
					lines[i].substr(-24) !== 'lacks an implementation.'
				) {
					errors.push(lines[i]);
				}
			}
			if (errors.length > 0) {
				bundle.error(ERROR + errors.join('\n'));
				return;
			}
			else
				result = true;
		}

		var jsPath = cacheDir + '/' + baseName + '.js';
		var mapPath = cacheDir + '/' + baseName + '.js.map';

		if (fs.existsSync(jsPath)) {
			if (result !== null) {
				var sourceBuffer = new Buffer(fs.readFileSync(source_path));
				var test;
				var compiledBuffer = new Buffer(
					test = fs.readFileSync(jsPath).toString().replace(
						/\/\/@ sourceMappingURL=[0-9a-zA-Z_.-]+/,
						'//@ sourceMappingURL=' + serve_path + '.map?' + changeTime.getTime()
					)
				);
				var mapBuffer = new Buffer(
					fs.readFileSync(mapPath).toString().replace(
						/"sources":\["[0-9a-zA-Z-\/\.-]+"]/,
						'"sources":["' + path.dirname(serve_path) + '/' + path.basename(serve_path)  + '?' + changeTime.getTime() + '"]'
					)
				);
				fs.writeFileSync(cachePath, sourceBuffer);
				fs.writeFileSync(cachePath + '.js', compiledBuffer);
				fs.writeFileSync(cachePath + '.map', mapBuffer);
			}

			// Delete the created file afterwards and add the content to the bundle
			fs.unlinkSync(jsPath);
			fs.unlinkSync(mapPath);
		}
		else {
			bundle.error(ERROR);
			return;
		}

	}

	// source
	bundle.add_resource({
		type: "static",
		path: serve_path,
		data: new Buffer(fs.readFileSync(cachePath)),
		where: where
	});

	// map
	bundle.add_resource({
		type: "static",
		path: serve_path + '.map',
		data: new Buffer(fs.readFileSync(cachePath + '.map')),
		where: where
	});

	// compiled
	bundle.add_resource({
		type: "js",
		path: serve_path + '.js',
		data: new Buffer(fs.readFileSync(cachePath + '.js')),
		where: where
	});

});