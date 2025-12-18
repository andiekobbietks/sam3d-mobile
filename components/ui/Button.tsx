import { cn } from "@/lib/utils";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

const buttonVariants = {
  default:
    "flex items-center justify-center rounded-md bg-primary px-4 py-2 active:opacity-80",
  destructive:
    "flex items-center justify-center rounded-md bg-destructive px-4 py-2 active:opacity-80",
  outline:
    "flex items-center justify-center rounded-md border border-primary px-4 py-2 active:opacity-80",
  secondary:
    "flex items-center justify-center rounded-md bg-secondary px-4 py-2 active:opacity-80",
  ghost:
    "flex items-center justify-center rounded-md px-4 py-2 active:bg-accent active:opacity-80",
};

const buttonTextVariants = {
  default: "text-base font-semibold text-white",
  destructive: "text-base font-semibold text-white",
  outline: "text-base font-semibold text-primary",
  secondary: "text-base font-semibold text-white",
  ghost: "text-base font-semibold text-primary",
};

const buttonSizeVariants = {
  default: "px-4 py-2",
  sm: "px-3 py-1",
  lg: "px-8 py-3",
};

interface ButtonProps {
  onPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizeVariants;
}

export const Button = React.forwardRef<
  any,
  ButtonProps & React.ComponentPropsWithoutRef<typeof Pressable>
>(
  (
    {
      onPress,
      children,
      disabled = false,
      variant = "default",
      size = "default",
      className,
      ...props
    },
    ref
  ) => {
    const buttonClass = cn(
      buttonVariants[variant],
      buttonSizeVariants[size],
      disabled && "opacity-50",
      className
    );

    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={onPress}
        className={buttonClass}
        {...props}
      >
        {typeof children === "string" ? (
          <Text className={buttonTextVariants[variant]}>{children}</Text>
        ) : Array.isArray(children) ? (
          <View className="flex flex-row items-center justify-center gap-2">
            {children}
          </View>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";
