import { Button } from "./primitives";
export type RecordingButtonProps = { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; danger?: boolean };
export function RecordingButton(props: RecordingButtonProps) { return <Button {...props} secondary={!props.danger} />; }
