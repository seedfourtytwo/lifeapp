import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Chip } from '../../ui/Chip';
import { DateField } from '../../ui/DateField';
import type { DayMark } from '../../ui/dayMarks';
import { Divider } from '../../ui/Divider';
import { Dock } from '../../ui/Dock';
import { Dot } from '../../ui/Dot';
import { Field } from '../../ui/Field';
import { GlassSurface } from '../../ui/GlassSurface';
import { Icon } from '../../ui/Icon';
import { useConfirm, useUndoBar } from '../../ui/KitHost';
import { Mark } from '../../ui/Mark';
import { NightBackground } from '../../ui/NightBackground';
import { NightText } from '../../ui/NightText';
import { pickTime } from '../../ui/phonePicker';
import { PillButton } from '../../ui/PillButton';
import { ProgressLine } from '../../ui/ProgressLine';
import { Road } from '../../ui/Road';
import { RIDE_LAMP_AT, rideCarAt } from '../../ui/roadScene';
import { RoundButton } from '../../ui/RoundButton';
import { Row } from '../../ui/Row';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Section } from '../../ui/Section';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { TextButton } from '../../ui/TextButton';
import { TimeField } from '../../ui/TimeField';
import { Toggle } from '../../ui/Toggle';
import { UndoBar } from '../../ui/UndoBar';
import { WeekDashes } from '../../ui/WeekDashes';
import {
  MARK_SIZE,
  NIGHT_LIGHTS,
  nightColors,
  nightRadius,
  nightStroke,
  nightType,
  space,
  type NightTypeRole,
} from '../../ui/tokens';

/**
 * Every part of the Night road kit in every state it has, on the night, for
 * reviewing the look on the phone; then the habit editor and a run of Today
 * tiles built from nothing but the kit. Development builds only: the route
 * is registered behind `__DEV__` (`src/navigation/devRoutes.ts`). The words
 * are sample data, in English.
 */
export default function KitGallery() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <NightBackground />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Kit gallery" back={{ label: 'Back', onPress: () => navigation.goBack() }} />
        <Colours />
        <Type />
        <Surfaces />
        <Buttons />
        <Inputs />
        <Pickers />
        <Overlays />
        <Navigation />
        <Progress />
        <Icons />
        <HabitEditorExample />
        <TodayExample />
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <NightText kind="title" accessibilityRole="header">
        {title}
      </NightText>
      {children}
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <View style={styles.line}>{children}</View>;
}

const COLOURS: (keyof typeof nightColors)[] = [
  'ground',
  'glassTop',
  'glassMiddle',
  'glassBottom',
  'glassEdge',
  'quietEdge',
  'well',
  'divider',
  'track',
  'missed',
  'notCounted',
  'grabber',
  'cream',
  'creamDim',
  'ink',
  'violet',
  'violetTint',
  'teal',
  'tealTint',
  'amber',
  'amberTint',
  'lamp',
  'tail',
  'danger',
  'asphalt',
  'lampPost',
];

function Colours() {
  return (
    <Group title="Colours">
      <GlassSurface>
        <View style={styles.wrap}>
          {COLOURS.map((name) => (
            <View key={name} style={styles.swatchCell}>
              <View style={[styles.swatch, { backgroundColor: nightColors[name] as string }]} />
              <NightText kind="caption" tone="dim">
                {name}
              </NightText>
            </View>
          ))}
        </View>
      </GlassSurface>
      <View style={styles.skyRow}>
        {nightColors.sky.map((stop) => (
          <View key={stop} style={[styles.skyStop, { backgroundColor: stop }]} />
        ))}
      </View>
    </Group>
  );
}

const TYPE_SAMPLES: Record<NightTypeRole, string> = {
  number: '07:42',
  numberSmall: '12:05',
  stat: '24 / 30',
  place: 'Wed 11 Nov',
  title: 'Meditation',
  name: 'Burp kefir',
  statement: 'Ridden out.',
  ownWords: 'I sleep better now.',
  ownLine: 'Head was loud. Stayed anyway.',
  body: 'What led to it?',
  caption: '5 of 8 glasses',
};

function Type() {
  return (
    <Group title="Type">
      <GlassSurface style={styles.stack}>
        {(Object.keys(nightType) as NightTypeRole[]).map((role) => (
          <View key={role}>
            <NightText kind="caption" tone="dim">
              {role}
            </NightText>
            <NightText kind={role}>{TYPE_SAMPLES[role]}</NightText>
          </View>
        ))}
        <Divider />
        <Line>
          <NightText kind="body">Cream</NightText>
          <NightText kind="body" tone="dim">
            Dim
          </NightText>
          <NightText kind="body" tone="violet">
            Violet
          </NightText>
          <NightText kind="body" tone="teal">
            Teal
          </NightText>
          <NightText kind="body" tone="amber">
            Amber
          </NightText>
          <NightText kind="body" tone="danger">
            Danger
          </NightText>
        </Line>
      </GlassSurface>
    </Group>
  );
}

function Surfaces() {
  const [weather, setWeather] = useState(true);
  return (
    <Group title="Surfaces">
      <GlassSurface>
        <NightText kind="name">Surface</NightText>
        <NightText kind="caption" tone="dim">
          A larger glass on its own
        </NightText>
      </GlassSurface>
      <GlassSurface size="tile">
        <NightText kind="name">Tile</NightText>
      </GlassSurface>
      {NIGHT_LIGHTS.map((light) => (
        <GlassSurface key={light} size="tile" light={light}>
          <NightText kind="name">Lit edge, {light}</NightText>
        </GlassSurface>
      ))}
      <GlassSurface size="tile" onPress={() => undefined} accessibilityLabel="Pressable tile">
        <NightText kind="name">Pressable tile</NightText>
      </GlassSurface>
      <GlassSurface size="tile" onPress={() => undefined} accessibilityLabel="Disabled tile" disabled>
        <NightText kind="name">Disabled tile</NightText>
      </GlassSurface>
      <Section label="Section, grouped rows" grouped>
        <Row label="Language" value="English" chevron onPress={() => undefined} />
        <Row label="Weather" value="Home" trailing={<Toggle value={weather} onValueChange={setWeather} accessibilityLabel="Weather" />} />
        <Row label="Backed up" value="Today 03:10" dot="teal" />
        <Row label="Archived" value="3" chevron onPress={() => undefined} />
        <Row label="Restore" chevron onPress={() => undefined} disabled />
        <Row label="Erase everything" danger chevron onPress={() => undefined} />
      </Section>
      <Section label="Section, loose">
        <GlassSurface size="tile">
          <NightText kind="name">One</NightText>
        </GlassSurface>
        <GlassSurface size="tile">
          <NightText kind="name">Two</NightText>
        </GlassSurface>
      </Section>
      <Line>
        <Mark icon="meditation" />
        <Mark icon="water-outline" onPress={() => undefined} accessibilityLabel="Change icon" />
        {NIGHT_LIGHTS.map((light) => (
          <Dot key={light} light={light} />
        ))}
        <Dot light="lamp" />
      </Line>
    </Group>
  );
}

function Buttons() {
  return (
    <Group title="Buttons">
      {NIGHT_LIGHTS.map((light) => (
        <PillButton key={light} variant="primary" light={light} label={`Primary, ${light}`} onPress={() => undefined} />
      ))}
      <PillButton variant="quiet" label="Quiet" onPress={() => undefined} />
      <PillButton variant="danger" label="Erase" onPress={() => undefined} />
      <PillButton variant="primary" label="Disabled" onPress={() => undefined} disabled />
      <Line>
        <PillButton variant="quiet" compact label="Edit" onPress={() => undefined} />
        <PillButton variant="primary" compact light="teal" label="Compact" onPress={() => undefined} />
      </Line>
      <Line>
        <RoundButton icon="cog-outline" size="sm" accessibilityLabel="Small" onPress={() => undefined} />
        <RoundButton icon="check" accessibilityLabel="Medium" onPress={() => undefined} />
        <RoundButton icon="play" size="lg" light="teal" accessibilityLabel="Large, lit" onPress={() => undefined} />
      </Line>
      <Line>
        {NIGHT_LIGHTS.map((light) => (
          <RoundButton key={light} icon="circle-outline" light={light} accessibilityLabel={`Lit ${light}`} onPress={() => undefined} />
        ))}
        <RoundButton icon="delete-outline" danger accessibilityLabel="Delete" onPress={() => undefined} />
        <RoundButton icon="pause" disabled accessibilityLabel="Disabled" onPress={() => undefined} />
      </Line>
      <Line>
        <RoundButton label="+1" light="amber" accessibilityLabel="Add 1" onPress={() => undefined} />
        <RoundButton label="+2" accessibilityLabel="Add 2" onPress={() => undefined} />
        <RoundButton label="+250" accessibilityLabel="Add 250" onPress={() => undefined} />
      </Line>
      <Line>
        <TextButton label="Quiet" onPress={() => undefined} />
        <TextButton label="Undo" tone="cream" onPress={() => undefined} />
        <TextButton label="Restore" tone="teal" onPress={() => undefined} />
        <TextButton label="Disabled" onPress={() => undefined} disabled />
      </Line>
    </Group>
  );
}

function Inputs() {
  const [name, setName] = useState('Meditation');
  const [goal, setGoal] = useState('15');
  const [on, setOn] = useState(true);
  const [type, setType] = useState<'check' | 'timer'>('timer');
  const [days, setDays] = useState<'every' | 'pick' | 'few'>('every');
  const [chosen, setChosen] = useState(true);
  return (
    <Group title="Inputs">
      <Field value={name} onChangeText={setName} placeholder="Name" accessibilityLabel="Name" />
      <Field label="Goal" value={goal} onChangeText={setGoal} numeric unit="min" />
      <Field label="Typed, disabled" value="Sit" onChangeText={() => undefined} disabled />
      <Field label="Sound" value="Meditation, 15 min" onPress={() => undefined} />
      <Field label="Shown, not pressable" value="glasses" />
      <Field label="Empty" value="" placeholder="None" onPress={() => undefined} />
      <Field label="Disabled" value="15 min" onPress={() => undefined} disabled />
      <GlassSurface>
        {NIGHT_LIGHTS.map((light) => (
          <Row
            key={light}
            label={`Toggle, ${light}`}
            trailing={<Toggle value={on} onValueChange={setOn} light={light} accessibilityLabel={`Toggle ${light}`} />}
          />
        ))}
        <Row label="Off" trailing={<Toggle value={false} onValueChange={() => undefined} accessibilityLabel="Off" />} />
        <Row label="Disabled" trailing={<Toggle value onValueChange={() => undefined} disabled accessibilityLabel="Disabled" />} />
      </GlassSurface>
      <Segmented
        accessibilityLabel="Type"
        options={[
          { value: 'check', label: 'Check-off' },
          { value: 'timer', label: 'Timer' },
        ]}
        value={type}
        onChange={setType}
      />
      <Segmented
        accessibilityLabel="Days"
        light="amber"
        options={[
          { value: 'every', label: 'Every day' },
          { value: 'pick', label: 'Pick days' },
          { value: 'few', label: 'Every few' },
        ]}
        value={days}
        onChange={setDays}
      />
      <Segmented
        accessibilityLabel="Disabled"
        disabled
        options={[
          { value: 'a', label: 'One' },
          { value: 'b', label: 'Two' },
        ]}
        value="a"
        onChange={() => undefined}
      />
      <View style={styles.wrap}>
        <Chip label="Chosen" selected={chosen} onPress={() => setChosen(!chosen)} />
        <Chip label="Not chosen" selected={false} onPress={() => undefined} />
        <Chip label="Amber" selected light="amber" onPress={() => undefined} />
        <Chip label="Plain" onPress={() => undefined} />
        <Chip label="Disabled" selected onPress={() => undefined} disabled />
        <Chip add accessibilityLabel="Add one" onPress={() => undefined} />
      </View>
    </Group>
  );
}

function Pickers() {
  const [time, setTime] = useState<string | null>('07:30');
  const [unset, setUnset] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>('2026-11-09');
  return (
    <Group title="Pickers">
      <TimeField label="Evening check-in" value={time} onChange={setTime} />
      <TimeField label="No time yet" value={unset} onChange={setUnset} placeholder="Pick a time" />
      <DateField label="Clear since" value={day} onChange={setDay} maximumDate="2026-12-31" />
      <DateField label="Disabled" value={day} onChange={setDay} disabled />
    </Group>
  );
}

function Overlays() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const confirm = useConfirm();
  const undo = useUndoBar();
  return (
    <Group title="Overlays">
      <PillButton variant="quiet" label="Open a sheet" onPress={() => setOpen(true)} />
      <PillButton
        variant="quiet"
        label="Ask to confirm"
        onPress={() =>
          void confirm({ title: 'Erase everything?', line: 'Every tracker and its history. This cannot be undone.', action: 'Erase' }).then(
            (erased) => undo.show({ message: erased ? 'Erased (not really)' : 'Kept' }),
          )
        }
      />
      <PillButton variant="quiet" label="Show the undo bar" onPress={() => undo.show({ message: 'Water +2', onUndo: () => undo.show({ message: 'Undone' }) })} />
      <PillButton variant="quiet" label="Show a plain notice" onPress={() => undo.show({ message: 'Could not save' })} />
      <UndoBar floating={false} message="Kefir done" action={{ label: 'Undo', onPress: () => undefined }} />
      <UndoBar floating={false} message="Could not save" />
      <Sheet visible={open} onClose={() => setOpen(false)} accessibilityLabel="A sheet">
        <NightText kind="title">A sheet</NightText>
        <NightText kind="body" tone="dim">
          Pull the grabber down, tap the night above, or press back.
        </NightText>
        <Field value={note} onChangeText={setNote} placeholder="Type to raise the keyboard" accessibilityLabel="Note" />
        <PillButton variant="primary" light="teal" label="Save" onPress={() => setOpen(false)} />
      </Sheet>
    </Group>
  );
}

const PLACES = [
  { key: 'today', icon: 'calendar-blank-outline', label: 'Today' },
  { key: 'road', icon: 'road-variant', label: 'Road' },
  { key: 'journal', icon: 'notebook-outline', label: 'Journal' },
] as const;

type Place = (typeof PLACES)[number]['key'];

function Navigation() {
  const [place, setPlace] = useState<Place>('today');
  return (
    <Group title="Navigation">
      <ScreenHeader
        title="Meditation"
        back={{ label: 'Back', onPress: () => undefined }}
        actions={
          <>
            <PillButton variant="quiet" compact label="Edit" onPress={() => undefined} />
            <RoundButton icon="dots-horizontal" size="sm" accessibilityLabel="Archive or delete" onPress={() => undefined} />
          </>
        }
      />
      <ScreenHeader
        title="Wed 11 Nov"
        actions={<RoundButton icon="cog-outline" size="sm" accessibilityLabel="Settings" onPress={() => undefined} />}
      />
      <Dock places={PLACES} active={place} onSelect={setPlace} action={{ icon: 'plus', label: 'Add', onPress: () => undefined }} />
    </Group>
  );
}

const WEEK: DayMark[] = ['done', 'done', 'missed', 'done', 'notCounted', 'done', 'today'];
const FORTNIGHT: DayMark[] = ['done', 'done', 'missed', 'done', 'done', 'done', 'missed', 'done', 'done', 'done', 'done', 'missed', 'done', 'done'];

function Progress() {
  return (
    <Group title="Progress">
      <GlassSurface style={styles.stack}>
        {NIGHT_LIGHTS.map((light, index) => (
          <ProgressLine key={light} value={[0, 0.62, 1][index]!} light={light} accessibilityLabel={`${light} progress`} />
        ))}
        <WeekDashes days={WEEK} light="teal" accessibilityLabel="4 of the last 6 days, today open" />
        <WeekDashes days={['missed', 'missed', 'missed', 'missed', 'missed', 'missed', 'missed']} light="amber" accessibilityLabel="None of the last 7 days" />
      </GlassSurface>
      <GlassSurface>
        <NightText kind="caption" tone="dim">
          Road: fourteen days, a lamp ahead
        </NightText>
        <Road days={FORTNIGHT} carAt={0.62} lampAt={0.86} accessibilityLabel="Road with the last fourteen days" />
      </GlassSurface>
      <GlassSurface>
        <NightText kind="caption" tone="dim">
          Road: a ride, halfway to the lamp
        </NightText>
        <Road carAt={rideCarAt(0.5)} lampAt={RIDE_LAMP_AT} accessibilityLabel="Halfway to the lamp" />
      </GlassSurface>
    </Group>
  );
}

function Icons() {
  return (
    <Group title="Icons">
      <Line>
        <Icon name="meditation" size="sm" />
        <Icon name="meditation" size="md" />
        <Icon name="meditation" size="lg" />
        <Icon name="water-outline" tone="dim" />
        {NIGHT_LIGHTS.map((light) => (
          <Icon key={light} name="circle-outline" tone={light} />
        ))}
        <Icon name="delete-outline" tone="danger" />
      </Line>
    </Group>
  );
}

/** The approved habit editor (`night-road-app.html`), drawn inline, and as a real sheet. */
function HabitEditorExample() {
  const [open, setOpen] = useState(false);
  return (
    <Group title="Habit editor">
      <GlassSurface style={styles.editorFrame}>
        <HabitEditorBody />
      </GlassSurface>
      <PillButton variant="quiet" label="Open it as a sheet" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} fill accessibilityLabel="Habit editor">
        <HabitEditorBody onSave={() => setOpen(false)} />
      </Sheet>
    </Group>
  );
}

function HabitEditorBody({ onSave }: { onSave?: () => void }) {
  const confirm = useConfirm();
  const undo = useUndoBar();
  const [name, setName] = useState('Meditation');
  const [type, setType] = useState<'check' | 'timer'>('timer');
  const [goal, setGoal] = useState('15');
  const [days, setDays] = useState<'every' | 'pick' | 'few'>('every');
  const [reminders, setReminders] = useState(['07:30', '21:00']);
  const [lockName, setLockName] = useState('Sit');
  const change = (index: number) =>
    void pickTime(reminders[index]!).then((picked) => {
      if (picked) setReminders(reminders.map((time, i) => (i === index ? picked : time)).sort());
    });
  return (
    <View style={styles.editor}>
      <View style={styles.nameLine}>
        <Mark icon="meditation" onPress={() => undefined} accessibilityLabel="Change icon" />
        <View style={styles.grow}>
          <Field value={name} onChangeText={setName} accessibilityLabel="Name" />
        </View>
      </View>
      <Segmented
        accessibilityLabel="Type"
        options={[
          { value: 'check', label: 'Check-off' },
          { value: 'timer', label: 'Timer' },
        ]}
        value={type}
        onChange={setType}
      />
      {type === 'timer' ? (
        <>
          <Field label="Goal" value={goal} onChangeText={setGoal} numeric unit="min" />
          <Field label="Sound" value="Meditation, 15 min" onPress={() => undefined} />
        </>
      ) : null}
      <Section label="Days">
        <View style={styles.wrap}>
          <Chip label="Every day" selected={days === 'every'} onPress={() => setDays('every')} />
          <Chip label="Pick days" selected={days === 'pick'} onPress={() => setDays('pick')} />
          <Chip label="Every few days" selected={days === 'few'} onPress={() => setDays('few')} />
        </View>
      </Section>
      <Section label="Reminders">
        <View style={styles.wrap}>
          {reminders.map((time, index) => (
            <Chip key={time} label={time} selected onPress={() => change(index)} accessibilityLabel={`Reminder at ${time}`} />
          ))}
          <Chip
            add
            accessibilityLabel="Add a reminder"
            onPress={() =>
              void pickTime(null).then((picked) => {
                if (picked && !reminders.includes(picked)) setReminders([...reminders, picked].sort());
              })
            }
          />
        </View>
      </Section>
      <Field label="Name on lock screen" value={lockName} onChangeText={setLockName} />
      <View style={styles.grow} />
      <View style={styles.footer}>
        <RoundButton
          icon="delete-outline"
          danger
          accessibilityLabel="Delete"
          onPress={() =>
            void confirm({ title: `Delete ${name}?`, line: 'Its history goes with it.', action: 'Delete' }).then((deleted) => {
              if (deleted) undo.show({ message: `${name} deleted (not really)` });
            })
          }
        />
        <View style={styles.grow}>
          <PillButton variant="primary" light="teal" label="Save" onPress={() => onSave?.()} />
        </View>
      </View>
    </View>
  );
}

/** A run of Today tiles, as in the approved Today mockup, with static data. */
function TodayExample() {
  const undo = useUndoBar();
  const [water, setWater] = useState(5);
  const add = (amount: number) => {
    setWater((value) => value + amount);
    undo.show({ message: `Water +${amount}`, onUndo: () => setWater((value) => value - amount) });
  };
  return (
    <Group title="Today">
      <ScreenHeader title="Wed 11 Nov" actions={<RoundButton icon="cog-outline" size="sm" accessibilityLabel="Settings" onPress={() => undefined} />} />
      <GlassSurface size="tile">
        <View style={styles.tileLine}>
          <View style={styles.grow}>
            <View style={styles.nameWithDot}>
              <Dot light="violet" />
              <NightText kind="name">Clear</NightText>
            </View>
            <NightText kind="caption" tone="dim">
              2d 15h, next lamp in 9 hours
            </NightText>
            <WeekDashes days={['done', 'done', 'missed', 'done', 'done', 'done', 'today']} light="violet" accessibilityLabel="5 of the last 6 days" />
          </View>
          <RoundButton icon="waves" light="amber" accessibilityLabel="Log an urge" onPress={() => undefined} />
        </View>
      </GlassSurface>
      <Section label="Morning">
        <GlassSurface>
          <NightText kind="caption" tone="dim">
            Next up, 3 of 5
          </NightText>
          <View style={styles.tileLine}>
            <View style={styles.grow}>
              <NightText kind="title">Meditation</NightText>
              <NightText kind="caption" tone="dim">
                15 min
              </NightText>
              <WeekDashes days={['done', 'done', 'done', 'missed', 'done', 'done', 'today']} light="teal" accessibilityLabel="5 of the last 6 days" />
            </View>
            <RoundButton icon="play" size="lg" light="teal" accessibilityLabel="Start Meditation" onPress={() => undefined} />
          </View>
        </GlassSurface>
        <GlassSurface size="tile">
          <View style={styles.tileLine}>
            <View style={styles.grow}>
              <NightText kind="name">Water</NightText>
              <NightText kind="caption" tone="dim">
                {water} of 8 glasses
              </NightText>
            </View>
            <RoundButton label="+1" light="amber" accessibilityLabel="Water, add 1" onPress={() => add(1)} />
            <RoundButton label="+2" accessibilityLabel="Water, add 2" onPress={() => add(2)} />
          </View>
          <View style={styles.below}>
            <ProgressLine value={water / 8} light="amber" accessibilityLabel={`Water, ${water} of 8 glasses`} />
          </View>
        </GlassSurface>
        <GlassSurface size="tile">
          <View style={styles.tileLine}>
            <Mark icon="bottle-tonic-outline" />
            <View style={styles.grow}>
              <NightText kind="name">Burp kefir</NightText>
              <WeekDashes days={['done', 'done', 'done', 'done', 'missed', 'done', 'today']} light="amber" accessibilityLabel="5 of the last 6 days" />
            </View>
            <RoundButton icon="circle-outline" accessibilityLabel="Mark Burp kefir done" onPress={() => undefined} />
          </View>
        </GlassSurface>
        <GlassSurface size="tile">
          <View style={styles.tileLine}>
            <View style={styles.grow}>
              <NightText kind="name">Call the plumber</NightText>
              <NightText kind="caption" tone="dim">
                Todo, today
              </NightText>
            </View>
            <RoundButton icon="circle-outline" accessibilityLabel="Mark Call the plumber done" onPress={() => undefined} />
          </View>
        </GlassSurface>
        <GlassSurface size="tile" onPress={() => undefined} accessibilityLabel="Done, 2: Mobility, Breathing">
          <NightText kind="caption" tone="dim">
            Done, 2: Mobility, Breathing
          </NightText>
        </GlassSurface>
      </Section>
      <GlassSurface size="tile" onPress={() => undefined} accessibilityLabel="Plants this week, 12 of 30">
        <View style={styles.tileLine}>
          <NightText kind="name" style={styles.grow}>
            Plants this week
          </NightText>
          <NightText kind="caption" tone="dim">
            12 of 30
          </NightText>
        </View>
        <View style={styles.below}>
          <ProgressLine value={12 / 30} light="teal" accessibilityLabel="Plants, 12 of 30" />
        </View>
      </GlassSurface>
      <Dock places={PLACES} active="today" onSelect={() => undefined} action={{ icon: 'plus', label: 'Add', onPress: () => undefined }} />
    </Group>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  group: {
    gap: space.md,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  stack: {
    gap: space.md,
  },
  swatchCell: {
    width: MARK_SIZE * 2,
    gap: space.xs,
  },
  swatch: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: nightRadius.inner,
    borderWidth: nightStroke.quiet,
    borderColor: nightColors.quietEdge,
  },
  skyRow: {
    flexDirection: 'row',
    borderRadius: nightRadius.tile,
    overflow: 'hidden',
  },
  skyStop: {
    flex: 1,
    height: MARK_SIZE,
  },
  editorFrame: {
    borderRadius: nightRadius.sheet,
  },
  editor: {
    flexGrow: 1,
    gap: space.md,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
  },
  tileLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  nameWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  below: {
    paddingTop: space.md,
  },
});
