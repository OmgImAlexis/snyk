var test = require('tap-only');
var tryRequire = require('snyk-try-require');
var interactive = require('./wizard-instrumented');
var answersToTasks = require('../cli/commands/protect/tasks');

test('wizard prompts as expected', function (t) {
  t.plan(2);
  t.test('groups correctly (with oui package)', function (t) {
    var responses = [ // 17
      'default:patch',
      'default:patch',
      'default:patch', // 4
      'default:patch', // 2
      'default:patch', // 2
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      false,
      false,];

    var vulns = require(__dirname + '/fixtures/oui.json');

    interactive(vulns, responses).then(function () {
      // console.log(res);
      t.pass('ok');
    }).catch(t.threw).then(t.end);
  });

  t.test('includes shrinkwrap when updating', function (t) {
    var responses = [ //
      'default:update', // 7
      'default:update', // 3
      'default:update', // 1
      'default:update', // 5
      'default:update', // 1
      'default:update', // 2
      'default:patch', // 2
      'default:patch', // 1
      'default:patch', // 1
      'default:patch', // 2
      ];

    var vulns = require(__dirname + '/fixtures/mean.json');

    tryRequire(__dirname + '/fixtures/pkg-mean-io/package.json').then(function (pkg) {
      var options = {
        pkg: pkg,
      };

      return interactive(vulns, responses, options).then(function (res) {
        t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
      });
    }).catch(t.threw).then(t.end);

  });
});

test('wizard supports review and ignore (SC-943)', function (t) {
  var responses = [
    'review',
    'ignore',
    'none given',
    'skip'];

  var vulns = require(__dirname + '/fixtures/scenarios/anna.json');

  return interactive(vulns, responses, { earlyExit: true }).then(function () {
    t.pass('ok');
  });
});

test('same name vulns do not get ignored (skipping in particular) (SC-1430)', function (t) {
  var responses = [
    'default:patch',
    'skip',
    'y',
    'n', ];

  var vulns = require(__dirname + '/fixtures/scenarios/SC-1430.json');

  return interactive(vulns, responses).then(function (res) {
    t.equal(Object.keys(res).length, 4, 'four prompts were answered');
  });
});

test('ignored grouped update explodes into multiple rules (SC-959)', function (t) {
  var responses = [
    'ignore',
    'none given',
    'skip'];

  var vulns = require(__dirname + '/fixtures/scenarios/explode-ignore.json');
  var total = vulns.vulnerabilities.length;

  return interactive(vulns, responses, { earlyExit: true }).then(function (answers) {
    var tasks = answersToTasks(answers);
    t.equal(tasks.ignore.length, total, 'should ignore all vulns');
  });
});

test('patch grouped vuln should run multiple patches (SC-1109)', function (t) {
  var responses = [
    'default:patch',
    'default:ignore',
    'none given',
  ];

  var vulns = require(__dirname + '/fixtures/scenarios/SC-1109.json');

  return interactive(vulns, responses, { earlyExit: true }).then(function (answers) {
    var tasks = answersToTasks(answers);
    var filenames = tasks.patch.map(function (_) {
      // trim the filename to remove the common path
      return _.__filename.replace(/.*\/node_modules\/tap\/node_modules\//, '');
    });
    t.notEqual(filenames[0], filenames[1], 'filenames should not be the same');

    // now it should only patch those files
    var patches = require('../lib/protect/dedupe-patches')(tasks.patch);

    t.equal(patches.packages.length, 2, '2 patches remain');
    t.equal(patches.packages[0].patches.id, 'patch:npm:request:20160119:0');
    t.equal(patches.packages[1].patches.id, 'patch:npm:request:20160119:4');
  });
});

test('vulns from extraneous deps are patched (SC-3560)', function (t) {
  var responses = [
    'default:update',
    'default:patch',
    'default:patch',
  ];

  var vulns = require(__dirname + '/fixtures/scenarios/SC-3560.json');
  var total = vulns.vulnerabilities.length;

  return interactive(vulns, responses, { earlyExit: true })
  .then(function (answers) {
    var tasks = answersToTasks(answers);
    t.equal(tasks.update[0].id, 'npm:jquery:20150627', 'prod jquery updated');
    t.equal(tasks.update.length, 1, '1 update');
    t.equal(tasks.patch[0].id, 'npm:ms:20170412', 'extraneous ms patched');
    t.equal(tasks.patch[1].id, 'npm:qs:20170213', 'extraneous qs patched');
    t.equal(tasks.patch.length, 2, '2 patches');
  });
});
