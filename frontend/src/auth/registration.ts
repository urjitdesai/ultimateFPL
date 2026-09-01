import { z } from "zod";

export const emailRegistrationSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).superRefine(({ password, confirmPassword }, context) => {
  if (confirmPassword && password !== confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export type EmailRegistrationForm = z.infer<typeof emailRegistrationSchema>;
