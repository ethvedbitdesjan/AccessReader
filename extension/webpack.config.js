const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    background: './src/background.ts',
    content: './src/content.ts',
    settings: './src/settings.ts',
    'llm-providers': './src/llm-providers.ts',
    'api-storage': './src/api_storage.ts',
    'audio': './src/audio.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'src/styles.css',
          to: 'styles.css'
        },
        {
          from: 'manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'src/settings.html',  // Add settings.html to be copied
          to: 'settings.html'
        }
      ],
    }),
  ],
  optimization: {
    minimize: false
  }
};