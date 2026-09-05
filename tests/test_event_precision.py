import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('extract_events', Path(__file__).resolve().parents[1] / 'pipeline/extract_events.py')
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)

class DatePrecisionTests(unittest.TestCase):
    def test_known_january_first_is_retained(self):
        self.assertEqual(extract.date_of('2002-01-01T00:00:00Z', 11), '2002-01-01')

    def test_padded_year_and_month_are_not_invented_days(self):
        for precision in (None, 9, 10):
            self.assertIsNone(extract.date_of('2002-01-01T00:00:00Z', precision))
        self.assertIsNone(extract.date_of('2002-04-01T00:00:00Z', 10))

    def test_bce_historical_row_years_include_one_bce(self):
        self.assertEqual(extract.year_of('0000-01-01T00:00:00Z'), -1)
        self.assertEqual(extract.year_of('-0001-01-01T00:00:00Z'), -2)

    def test_precise_query_matches_the_selected_statement_date(self):
        self.assertIn('?tv wikibase:timeValue ?when ; wikibase:timePrecision 11', extract.DATED_QUERY)
        self.assertIn('?bv wikibase:timeValue ?born ; wikibase:timePrecision 11', extract.PERSON_DEEP_QUERY)

if __name__ == '__main__':
    unittest.main()
