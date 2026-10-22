import type { GoogleContact } from '../types/gqueues';

const CUSTOM_ROSTER_KEY = 'gqueues_custom_team_roster';

export function getCustomTeammates(): GoogleContact[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROSTER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse custom team roster:', e);
  }
  return [];
}

export function saveCustomTeammate(contact: Omit<GoogleContact, 'id'> & { id?: string }): GoogleContact {
  const existing = getCustomTeammates();
  const normalizedEmail = contact.email.toLowerCase().trim();
  const found = existing.find((c) => c.email.toLowerCase() === normalizedEmail);

  const fullContact: GoogleContact = {
    id: found?.id || contact.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: contact.name.trim() || contact.email.split('@')[0],
    email: normalizedEmail,
    avatarUrl: contact.avatarUrl,
    jobTitle: contact.jobTitle || 'Team Member',
    department: contact.department,
    source: 'custom',
    isOrgMember: true,
  };

  const updated = [fullContact, ...existing.filter((c) => c.email.toLowerCase() !== normalizedEmail)];
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save custom teammate:', e);
  }
  return fullContact;
}

export function removeCustomTeammate(email: string): void {
  const existing = getCustomTeammates();
  const normalizedEmail = email.toLowerCase().trim();
  const updated = existing.filter((c) => c.email.toLowerCase() !== normalizedEmail);
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to remove custom teammate:', e);
  }
}

/**
 * Searches the Google Workspace Organization Directory live for a specific query
 */
export async function searchDirectoryPeople(accessToken: string, query: string): Promise<GoogleContact[]> {
  if (!query || !query.trim()) return [];
  try {
    const trimmed = query.trim();
    const url = `https://people.googleapis.com/v1/people:searchDirectory?readMask=names,emailAddresses,photos,organizations&query=${encodeURIComponent(
      trimmed
    )}&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE,DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT&pageSize=50`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      const people = data.people || [];
      const results: GoogleContact[] = [];

      for (const person of people) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName || email;
        const photo = person.photos?.[0]?.url;
        const org = person.organizations?.[0];
        const jobTitle = org?.title;
        const department = org?.department;

        if (email) {
          results.push({
            id: person.resourceName || email,
            name: name || email,
            email: email.toLowerCase().trim(),
            avatarUrl: photo,
            jobTitle: jobTitle || 'Workspace User',
            department,
            source: 'directory',
            isOrgMember: true,
          });
        }
      }
      return results;
    }
  } catch (err) {
    console.warn('Live directory search error:', err);
  }
  return [];
}

/**
 * Loads all available contacts & Google Workspace organization directory users.
 * Automatically aggregates from:
 * 1. Google Workspace Directory (`people:listDirectoryPeople`)
 * 2. Domain directory search for company users
 * 3. Google Contacts connections (`people/me/connections`)
 * 4. Google Other Contacts (`otherContacts`)
 * 5. Local organization roster
 */
export async function fetchContacts(accessToken: string, userDomain?: string): Promise<GoogleContact[]> {
  const contactMap = new Map<string, GoogleContact>();

  // Determine domain name if available (e.g. "coolaireconsolidated.com")
  const targetDomain = userDomain?.toLowerCase().trim();
  const domainPrefix = targetDomain ? targetDomain.split('.')[0] : '';

  // Helper to mark org membership
  const checkIsOrgMember = (email: string, source?: string) => {
    if (source === 'directory') return true;
    if (targetDomain && email.toLowerCase().endsWith(`@${targetDomain}`)) return true;
    if (email.toLowerCase().includes('coolaire')) return true;
    return false;
  };

  // 1. Load custom saved organization roster
  const customList = getCustomTeammates();
  for (const c of customList) {
    if (c.email) {
      const lower = c.email.toLowerCase();
      contactMap.set(lower, {
        ...c,
        isOrgMember: true,
      });
    }
  }

  // 2. Fetch Google Workspace Directory (people:listDirectoryPeople)
  try {
    let pageToken: string | undefined = undefined;
    let pagesLoaded = 0;

    do {
      const pageParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const dirUrl: string = `https://people.googleapis.com/v1/people:listDirectoryPeople?readMask=names,emailAddresses,photos,organizations&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE,DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT&pageSize=1000${pageParam}`;

      const dirRes: Response = await fetch(dirUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!dirRes.ok) {
        break;
      }

      const dirData: any = await dirRes.json();
      const people: any[] = dirData.people || [];

      for (const person of people) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName || email;
        const photo = person.photos?.[0]?.url;
        const org = person.organizations?.[0];
        const jobTitle = org?.title;
        const department = org?.department;

        if (email) {
          const lower = email.toLowerCase().trim();
          contactMap.set(lower, {
            id: person.resourceName || email,
            name: name || email,
            email: lower,
            avatarUrl: photo,
            jobTitle: jobTitle || 'Coolaire Team Member',
            department,
            source: 'directory',
            isOrgMember: true,
          });
        }
      }

      pageToken = dirData.nextPageToken;
      pagesLoaded++;
    } while (pageToken && pagesLoaded < 5);
  } catch (err) {
    console.info('Google Workspace listDirectoryPeople notice:', err);
  }

  // 3. Fallback/Augment: If directory listing didn't get all domain profiles, execute searchDirectory
  if (domainPrefix || targetDomain) {
    const searchQueries: string[] = [domainPrefix, targetDomain, 'coolaire'].filter(
      (x): x is string => Boolean(x)
    );
    for (const q of searchQueries) {
      try {
        const searchResults = await searchDirectoryPeople(accessToken, q);
        for (const person of searchResults) {
          const lower = person.email.toLowerCase().trim();
          if (!contactMap.has(lower)) {
            contactMap.set(lower, person);
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // 4. Fetch Google Contacts connections (Personal & shared contacts)
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos,organizations&pageSize=1000&sortOrder=FIRST_NAME_ASCENDING',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const connections = data.connections || [];

      for (const person of connections) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName || email;
        const photo = person.photos?.[0]?.url;
        const org = person.organizations?.[0];
        const jobTitle = org?.title;
        const department = org?.department;

        if (email) {
          const lower = email.toLowerCase().trim();
          const isOrg = checkIsOrgMember(lower);
          const existing = contactMap.get(lower);

          if (!existing) {
            contactMap.set(lower, {
              id: person.resourceName || email,
              name: name || email,
              email: lower,
              avatarUrl: photo,
              jobTitle,
              department,
              source: isOrg ? 'directory' : 'contacts',
              isOrgMember: isOrg,
            });
          } else if (isOrg) {
            existing.isOrgMember = true;
            if (!existing.avatarUrl && photo) existing.avatarUrl = photo;
            if (!existing.jobTitle && jobTitle) existing.jobTitle = jobTitle;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Note: Personal Google Contacts fetch failed:', err);
  }

  // 5. Fetch Google Other Contacts (Frequent Workspace Collaborators in Domain)
  try {
    const otherRes = await fetch(
      'https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses,photos&pageSize=1000',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (otherRes.ok) {
      const otherData = await otherRes.json();
      const otherList = otherData.otherContacts || [];
      for (const person of otherList) {
        const email = person.emailAddresses?.[0]?.value;
        const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName || email;
        const photo = person.photos?.[0]?.url;

        if (email) {
          const lower = email.toLowerCase().trim();
          const isOrg = checkIsOrgMember(lower);
          const existing = contactMap.get(lower);

          if (!existing) {
            contactMap.set(lower, {
              id: person.resourceName || email,
              name: name || email,
              email: lower,
              avatarUrl: photo,
              source: isOrg ? 'directory' : 'other',
              isOrgMember: isOrg,
            });
          } else if (isOrg) {
            existing.isOrgMember = true;
          }
        }
      }
    }
  } catch (err) {
    console.info('Google Other Contacts query notice:', err);
  }

  // Sort: Org Directory & Teammates first, then alphabetically by name
  return Array.from(contactMap.values()).sort((a, b) => {
    if (a.isOrgMember && !b.isOrgMember) return -1;
    if (!a.isOrgMember && b.isOrgMember) return 1;
    return a.name.localeCompare(b.name);
  });
}
