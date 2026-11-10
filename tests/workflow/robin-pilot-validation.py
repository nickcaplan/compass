"""Offline guard tests. Does not invoke Robin, GitHub or OpenRouter."""
import copy, io, json, os, pathlib, tempfile, unittest, urllib.request
from unittest.mock import patch

workflow = pathlib.Path('.github/workflows/robin-pilot.yml').read_text()
script = workflow.split("          python3 - <<'PY'\n",1)[1].split("\n          PY",1)[0]
script = '\n'.join(line[10:] for line in script.splitlines())
SHA = 'a'*40
PR = {'state':'open','draft':False,'head':{'repo':{'full_name':'nickcaplan/compass'},'sha':SHA},'base':{'ref':'main'}}
FILES = [{'filename':'src/styles.css','status':'modified'}]

class PilotGuardTests(unittest.TestCase):
    def run_guard(self, event='workflow_dispatch', expected=SHA, pr=None, files=None, diff='CSS'):
        with tempfile.TemporaryDirectory() as directory:
            native = pathlib.Path(directory,'native.json');native.write_text('{"native":true}')
            output = pathlib.Path(directory,'output')
            env = {'EXPECTED_HEAD':expected,'GITHUB_EVENT_NAME':event,'GH_TOKEN':'fake-not-a-secret',
                   'RUNNER_TEMP':directory,'GITHUB_EVENT_PATH':str(native),'GITHUB_OUTPUT':str(output)}
            responses = [json.dumps(pr if pr is not None else PR).encode(),json.dumps(files if files is not None else FILES).encode(),diff.encode()]
            def request(req, timeout):
                self.assertTrue(req.full_url.startswith('https://api.github.com/repos/nickcaplan/compass/pulls/89'))
                return io.BytesIO(responses.pop(0))
            with patch.dict(os.environ,env),patch.object(urllib.request,'urlopen',side_effect=request):
                exec(compile(script,'guard','exec'),{})
            result=output.read_text()
            context=pathlib.Path(directory,'robin-pilot-event.json')
            return result,json.loads(context.read_text()) if context.exists() else None
    def test_manual_adapts_expected_pr(self):
        result,context=self.run_guard();self.assertIn('event_name=pull_request',result);self.assertEqual(context['number'],89);self.assertEqual(context['pull_request']['head']['sha'],SHA)
    def test_native_preserves_original_context(self):
        result,context=self.run_guard(event='issue_comment',expected='');self.assertIn('event_name=issue_comment',result);self.assertIn('head='+SHA,result);self.assertIsNone(context)
    def test_invalid_manual_sha(self):
        with self.assertRaises(SystemExit): self.run_guard(expected='main')
    def test_stale_head(self):
        with self.assertRaises(SystemExit): self.run_guard(expected='b'*40)
    def test_closed_draft_fork_or_other_base(self):
        for change in ['closed','draft','fork','base']:
            pr=copy.deepcopy(PR)
            if change=='closed': pr['state']='closed'
            if change=='draft': pr['draft']=True
            if change=='fork': pr['head']['repo']['full_name']='untrusted/fork'
            if change=='base': pr['base']['ref']='other'
            with self.subTest(change=change),self.assertRaises(SystemExit): self.run_guard(pr=pr)
    def test_other_or_extra_file(self):
        for files in [[{'filename':'src/main.js','status':'modified'}],FILES+FILES]:
            with self.assertRaises(SystemExit):self.run_guard(files=files)
    def test_complete_diff_cap(self):
        with self.assertRaises(SystemExit):self.run_guard(diff='x'*20001)
    def test_workflow_has_no_automatic_review_or_checkout(self):
        self.assertNotIn('pull_request:',workflow.split('permissions:',1)[0]);self.assertNotIn('actions/checkout',workflow)
        self.assertIn("github.actor == 'nickcaplan'",workflow);self.assertIn("github.triggering_actor == 'nickcaplan'",workflow);self.assertIn("github.event.comment.body == '/review'",workflow)
        self.assertNotIn('          GITHUB_EVENT_NAME:',workflow)
        self.assertNotIn('          GITHUB_EVENT_PATH:',workflow)
        self.assertIn("env['GITHUB_EVENT_NAME']='pull_request'",workflow)
        self.assertIn('hashlib.sha256(bundle).hexdigest()',workflow)

if __name__=='__main__':unittest.main()
