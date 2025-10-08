const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Build JavaScript
esbuild.build({
  entryPoints: ['src/frontend/main.tsx'],
  bundle: true,
  outfile: 'dist/react-app.js',
  platform: 'browser',
  target: ['es2018'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js'
  },
  external: ['*.css'],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: false,
  sourcemap: true
}).then(() => {
  console.log('✓ JavaScript bundle completed');
}).catch((error) => {
  console.error('JavaScript build failed:', error);
  process.exit(1);
});

// Build CSS
esbuild.build({
  entryPoints: ['public/fontawesome-bundle.css'],
  bundle: true,
  outfile: 'dist/fontawesome.css',
  loader: {
    '.css': 'css',
    '.woff': 'file',
    '.woff2': 'file',
    '.eot': 'file',
    '.ttf': 'file',
    '.svg': 'file'
  }
}).then(() => {
  // Copy main CSS
  fs.copyFileSync('public/main.css', 'dist/main.css');
  
  // Copy HTML
  fs.copyFileSync('public/index.html', 'dist/index.html');
  
  console.log('✓ Frontend build completed successfully');
}).catch((error) => {
  console.error('CSS build failed:', error);
  process.exit(1);
});
