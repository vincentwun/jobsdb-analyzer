const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.build({
  entryPoints: ['src/frontend-react/main.tsx'],
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
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: false,
  sourcemap: true
}).then(() => {
  fs.copyFileSync('src/frontend-react/styles/main.css', 'dist/main.css');
  fs.copyFileSync('src/frontend-react/index.html', 'dist/index.html');
  console.log('✓ Frontend build completed successfully');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
