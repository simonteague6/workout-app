import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// SDK 56 split expo-file-system: the new top-level module is the File/Directory
// API; the classic writeAsStringAsync/readAsStringAsync/cacheDirectory helpers
// live under the /legacy subpath.
import { cacheDirectory, writeAsStringAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ScreenContainer, Section, PrimaryButton } from '../../components/SettingsControls.js';
import { getDatabase } from '../../utils/db.js';
import { exportToJson, exportHistoryToCsv, importFromJson } from '../../db/queries/portabilityQueries.js';

// Data — JSON backup/restore + CSV history export. The data layer
// (portabilityQueries) is unit-tested; this screen is the thin native shell
// that writes a temp file and shares it (export) or reads a picked file and
// restores (import). Import is JSON-only and surfaces parse errors via Alert.
export default function DataScreen() {
  return (
    <ScreenContainer>
      <Section title="Backup & Restore">
        <PrimaryButton label="Export full backup (JSON)" onPress={onExportJson} />
        <PrimaryButton label="Import backup (JSON)" onPress={onImport} tone="danger" />
      </Section>

      <Section title="Spreadsheet">
        <PrimaryButton label="Export workout history (CSV)" onPress={onExportCsv} />
      </Section>
    </ScreenContainer>
  );
}

async function onExportJson() {
  try {
    const json = exportToJson(getDatabase());
    const uri = `${cacheDirectory}workout-backup-${Date.now()}.json`;
    await writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export workout data' });
  } catch (err) {
    Alert.alert('Export failed', err.message);
  }
}

async function onExportCsv() {
  try {
    const csv = exportHistoryToCsv(getDatabase());
    const uri = `${cacheDirectory}workout-history-${Date.now()}.csv`;
    await writeAsStringAsync(uri, csv, { encoding: EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export workout history' });
  } catch (err) {
    Alert.alert('Export failed', err.message);
  }
}

async function onImport() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets || !result.assets.length) return;
    const file = result.assets[0];
    const text = await readAsStringAsync(file.uri, {
      encoding: EncodingType.UTF8,
    });
    const summary = importFromJson(getDatabase(), text);
    Alert.alert('Import complete', `Restored ${summary.rows} rows across ${summary.tables.length} tables.`);
  } catch (err) {
    Alert.alert('Import failed', err.message);
  }
}