import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from app import app
from backend.memory import MeetingScope, bank_for


class MemoryTests(unittest.TestCase):
    def setUp(self):
        self.http = TestClient(app)
        self.note = dict(company='Northstar Labs', contact='Anika Rao', meeting_id=str(uuid4()),
                         meeting_date='2026-09-14', objection='Security review pending',
                         commitment='Send questionnaire', preference='Three bullets', outcome='Postponed')
        self.query = dict(company='Northstar Labs', contact='Anika Rao', goal='Agree on pilot')

    def test_missing_configuration_is_explicit(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.http.post('/api/memory/retain', json=self.note).status_code, 503)
            self.assertFalse(self.http.get('/api/memory/status').json()['configured'])

    def test_invalid_inputs(self):
        for override in [{'company':'  '}, {'meeting_date':'not-a-date'}, {'meeting_id':'invalid'}, {'outcome':''}]:
            self.assertEqual(self.http.post('/api/memory/retain', json=self.note | override).status_code, 422)

    def test_contact_isolation_and_case_normalization(self):
        first = bank_for(MeetingScope(company='Acme', contact='Alice'))
        self.assertEqual(first, bank_for(MeetingScope(company=' ACME ', contact='alice')))
        self.assertNotEqual(first, bank_for(MeetingScope(company='Acme', contact='Bob')))
        self.assertNotEqual(first, bank_for(MeetingScope(company='Other', contact='Alice')))

    @patch('backend.memory.make_client')
    def test_retain_uses_stable_document_id_and_real_event_date(self, factory):
        client = factory.return_value
        client.retain.return_value = SimpleNamespace(success=True)
        for _ in range(2):
            self.assertEqual(self.http.post('/api/memory/retain',json=self.note).status_code,200)
        kwargs=client.retain.call_args.kwargs
        self.assertEqual(kwargs['document_id'],self.note['meeting_id'])
        self.assertEqual(kwargs['timestamp'].date().isoformat(),'2026-09-14')
        self.assertFalse(kwargs['retain_async'])
        self.assertIn('Outcome: Postponed',kwargs['content'])
        self.assertEqual(client.close.call_count,2)

    @patch('backend.memory.make_client')
    def test_empty_memory_never_invents_a_brief(self, factory):
        client=factory.return_value
        client.recall.return_value=SimpleNamespace(results=[])
        result=self.http.post('/api/memory/prepare',json=self.query)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['evidence'],[])
        client.reflect.assert_not_called()

    @patch('backend.memory.make_client')
    def test_reflect_and_recall_evidence_are_both_visible(self,factory):
        client=factory.return_value
        client.recall.return_value=SimpleNamespace(results=[SimpleNamespace(id='one',text='Original objection')])
        client.reflect.return_value=SimpleNamespace(text='Security resolved; confirm budget.',based_on=SimpleNamespace(memories=[SimpleNamespace(id='two',text='Security resolved')]))
        result=self.http.post('/api/memory/prepare',json=self.query)
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json()['evidence']),2)
        self.assertTrue(client.reflect.call_args.kwargs['include_facts'])
        self.assertEqual(client.recall.call_args.kwargs['bank_id'],client.reflect.call_args.kwargs['bank_id'])

    @patch('backend.memory.make_client')
    def test_failure_is_not_replaced_with_fake_success(self,factory):
        client=factory.return_value
        client.recall.side_effect=RuntimeError('secret-provider-key')
        response=self.http.post('/api/memory/prepare',json=self.query)
        self.assertEqual(response.status_code,502)
        self.assertNotIn('secret-provider-key',response.text)
        client.close.assert_called_once()

    @patch('backend.memory.make_client')
    def test_failed_retain_does_not_claim_saved(self,factory):
        factory.return_value.retain.return_value=SimpleNamespace(success=False)
        self.assertEqual(self.http.post('/api/memory/retain',json=self.note).status_code,502)


if __name__ == '__main__':
    unittest.main()
