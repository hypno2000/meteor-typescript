/*global Package*/
Package.describe({
    summary : "TypeScript, a typed superset of Javascript that compiles to plain Javascript"
});

Npm.depends({"exec-sync": "0.1.5"});

Package.register_extension("ts", function (bundle, source_path, serve_path, where) {
    var fs = Npm.require('fs');
	var path = Npm.require('path');
	var execSync = Npm.require('exec-sync');

	var ERROR = "\nTypeScript compilation failed!\n";
	ERROR = ERROR + (new Array(ERROR.length - 1).join("-")) + "\n";
	// XXX Use other npm packages. Seen in the handlebars package ;)

    var compileOut = source_path + '.compiled_typescript_js', // using `.js` as an extension would cause Meteor to load this file
        compileCommand = 'tsc --nolib --sourcemap --out ' + compileOut + " " + source_path, // add client,server module type switch?
        bundlePath = path.dirname(serve_path) + '/' + path.basename(serve_path, '.ts') + '.js',
        result = null;

    // Compile the TypeScript file with the TypeScript command line compiler. 
    // Until the TypeScript module provides a public API there is no reliable way around it without changing the
    // TypeScript sources.
    try {
        result = execSync(compileCommand);
    } catch (e) {
	    result = true;
		 console.log(e);
//        bundle.error(ERROR + e);
    }

    var jsPath = compileOut + '/' + path.basename(source_path, '.ts') + '.js';
    var mapPath = compileOut + '/' + path.basename(source_path, '.ts') + '.js.map';
    if (fs.existsSync(jsPath)) {
        if (result !== null) {
			  bundle.add_resource({
				  type: "static", // WARNING : Seems to doesn't be updated on client reloading
				  path : serve_path,
				  data : new Buffer(fs.readFileSync(source_path)),
				  where : where
			  });
			  bundle.add_resource({
				  type: "static", // WARNING : Seems to doesn't be updated on client reloading
				  path : bundlePath + '.map',
				  data : new Buffer(fs.readFileSync(mapPath)),
				  data : new Buffer(fs.readFileSync(mapPath).toString().replace('"sources":["../', '"sources":["' + path.dirname(serve_path) + '/')),
				  where : where
			  });
			  bundle.add_resource({
				  type : "js",
				  path : bundlePath,
				  data : new Buffer(fs.readFileSync(jsPath).toString().replace('//@ sourceMappingURL=', '//@ sourceMappingURL=' + path.dirname(serve_path) + '/')),
				  where : where
			  });
        }
        //Delete the created file afterwards and add the content to the bundle
		 var rmDir = function(dirPath) {
			 try { var files = fs.readdirSync(dirPath); }
			 catch(e) { return; }
			 if (files.length > 0)
				 for (var i = 0; i < files.length; i++) {
					 var filePath = dirPath + '/' + files[i];
					 if (fs.statSync(filePath).isFile())
						 fs.unlinkSync(filePath);
					 else
						 rmDir(filePath);
				 }
			 fs.rmdirSync(dirPath);
		 };
		 rmDir(compileOut);
    } else {
        bundle.error(ERROR);
    }
});
