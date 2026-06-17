// OptionPickerModal — a lightweight modal picker used by the exercise library
// filters and the editor form (muscle group / equipment / exercise type / etc).
// Keeps issue #2 dependency-free: no third-party select, just a Modal + list.

import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme.js';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {{id:number|string,name:string}[]|string[]} props.options
 * @param {*} props.value            currently-selected id (highlighted)
 * @param {boolean} [props.nullable] show a "None" option at the top (clears)
 * @param {(option: {id:*,name:string}|null) => void} props.onSelect
 * @param {() => void} props.onClose
 */
export default function OptionPickerModal({
  visible,
  title,
  options,
  value,
  nullable,
  onSelect,
  onClose,
}) {
  // Normalize options to {id, name}.
  const normalized = options.map((o) =>
    typeof o === 'string' ? { id: o, name: o } : { id: o.id, name: o.name },
  );

  const choose = (option) => {
    onSelect?.(option);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={nullable ? [{ id: null, name: 'None' }, ...normalized] : normalized}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const selected = item.id === value || (value == null && item.id == null && nullable);
              return (
                <Pressable
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => choose(item.id === null ? null : item)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    maxHeight: '70%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});