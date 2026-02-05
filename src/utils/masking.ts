/**
 * Masks a string with asterisks matching its character count.
 * @param str The string to mask
 * @returns A string of asterisks with the same length
 */
export const maskString = (str: string | undefined | null): string => {
  if (!str) return '';
  return '*'.repeat(str.length);
};

/**
 * Sanitizes a user object if it is marked as anonymous.
 * Applies asterisk masking to Name, Current Company, and Education.
 * @param user The user object to sanitize
 * @returns The sanitized user object
 */
export const sanitizeUser = (user: any): any => {
  if (!user || !user.isAnonymous) return user;

  const sanitized = { ...user };

  // Mask Name
  if (sanitized.firstName) sanitized.firstName = maskString(sanitized.firstName);
  if (sanitized.lastName) sanitized.lastName = maskString(sanitized.lastName);
  
  // Virtual fullName if exists
  if (sanitized.fullName) {
    sanitized.fullName = `${maskString(user.firstName)} ${maskString(user.lastName)}`;
  }

  // Mask Identity
  sanitized.linkedinProfileUrl = undefined;
  sanitized.linkedinId = undefined;
  // Use a standard neutral avatar for anonymous users
  sanitized.profileImage = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

  // Mask Current Professional Fields
  if (sanitized.currentCompany) sanitized.currentCompany = maskString(sanitized.currentCompany);
  
  // Mask Work Experience Companies
  if (sanitized.workExperience && Array.isArray(sanitized.workExperience)) {
    sanitized.workExperience = sanitized.workExperience.map((work: any) => ({
      ...work,
      company: maskString(work.company)
    }));
  }

  // Mask Education Background Schools
  if (sanitized.educationBackground && Array.isArray(sanitized.educationBackground)) {
    sanitized.educationBackground = sanitized.educationBackground.map((edu: any) => ({
      ...edu,
      school: maskString(edu.school)
    }));
  }

  return sanitized;
};
