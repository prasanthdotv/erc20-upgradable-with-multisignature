module.exports = {
  exit: true,
  recursive: true,
  timeout: 60000,
  bail: true,
  parallel: true,
  reporter: 'mochawesome',
  'reporter-options': ["reportFilename= 'MyToken-Test-Report'", 'quiet= true'],
};
