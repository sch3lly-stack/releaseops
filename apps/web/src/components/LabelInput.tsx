import { fieldClass } from "../ui";

export function LabelInput(props: {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label htmlFor={props.name} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{props.label}</span>
      <input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        minLength={props.minLength}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
