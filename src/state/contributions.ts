import { selector, selectorFamily } from "recoil";
import { applicationRepository } from "src/model/applications/repository";
import { ContributorId } from "src/model/contact-information/repository";
import {
  AssignedStatus,
  CompletedStatus,
  ContributionDto,
  ContributionMetadata,
  ContributionStatusAndMetadata,
  ContributionStatusEnum,
  OpenStatus,
  ProjectDto,
  ProjectMember,
  projectRepository,
} from "src/model/projects/repository";
import {
  contributionsFilterContextAtom,
  contributionsFilterDifficultyAtom,
  contributionsFilterDurationAtom,
  contributionsFilterStatusAtom,
  contributionsFilterTechnologyAtom,
  contributionsFilterTypeAtom,
} from "./contributions-filters";
import { userContributorIdSelector } from "./profile-registry-contract";
import { accountAddressSelector } from "./starknet";

type ProjectBase = {
  id: string;
  title: string;
  description: string;
  logo?: string;
  github_link?: string;
  discord_link?: string;
  website_link?: string;
  members: string[];
};

export type Project = ProjectBase & {
  openedContributionsAmount: number;
  statuses: Array<Contribution["status"] | "gated">;
  technologies: Contribution["metadata"]["technology"][];
  durations: Contribution["metadata"]["duration"][];
  contexts: Contribution["metadata"]["context"][];
  difficulties: Contribution["metadata"]["difficulty"][];
  types: Contribution["metadata"]["type"][];
};

export type Contribution = {
  id: string;
  title: string;
  description: string;
  project: ProjectBase;
  github_link: string;
  eligible: boolean | null;
  applied: boolean;
  gate: number;
  gateMissingCompletedContributions: number;
} & ContributionStatusAndMetadata;

export type ContributionApplication = {
  contribution_id: Contribution["id"];
  contributor_id: ContributorId;
};

export type OpenContribution = Contribution & OpenStatus;
export type AssignedContribution = Contribution & AssignedStatus;
export type CompletedContribution = Contribution & CompletedStatus;

type RawProjectWithContributions = {
  project: Omit<ProjectDto, "contributions">;
  contributions: ContributionDto[];
};

export const rawProjectsWithContributionsQuery = selector<RawProjectWithContributions[]>({
  key: "RawProjects",
  get: async () => {
    const projects = await projectRepository.list();

    return projects.map(project => {
      const { contributions, ...projectFields } = project;

      return {
        project: projectFields,
        contributions,
      };
    });
  },
});

export const projectsQuery = selector({
  key: "Projects",
  get: ({ get }) => {
    const userContributorId = get(accountAddressSelector);
    const rawProjectsWithContributions = get(rawProjectsWithContributionsQuery);

    const completedContributionsAmount = countCompletedContributions(
      rawProjectsWithContributions,
      userContributorId as ContributorId
    );

    return rawProjectsWithContributions.map(({ project, contributions }) => {
      const formattedProject: Project = {
        ...formatProject(project),
        openedContributionsAmount: contributions.filter(
          contribution => contribution.status === ContributionStatusEnum.OPEN
        ).length,
        technologies: formatProjectTechnologies(contributions),
        statuses: formatProjectStatuses(contributions, completedContributionsAmount),
        durations: formatProjectMetadata("duration", contributions),
        contexts: formatProjectMetadata("context", contributions),
        difficulties: formatProjectMetadata("difficulty", contributions),
        types: formatProjectMetadata("type", contributions),
      };

      return formattedProject;
    });
  },
});

export const contributionsQuery = selector({
  key: "Contributions",
  get: async ({ get }) => {
    const rawProjectsWithContributions = get(rawProjectsWithContributionsQuery);
    const userContributorId = get(accountAddressSelector);
    const applications = get(contributorApplicationsQuery);

    const completedContributionsAmount = countCompletedContributions(
      rawProjectsWithContributions,
      userContributorId as ContributorId
    );

    const contributionsWithProjects = rawProjectsWithContributions.reduce<Contribution[]>(
      (aggregatedContributions, { contributions, project }) => {
        return [
          ...aggregatedContributions,
          ...contributions.map(contributionDto => {
            const contribution: Contribution = {
              ...contributionDto,
              project: formatProject(project),
              eligible:
                completedContributionsAmount === null ? null : completedContributionsAmount >= contributionDto.gate,
              applied: applications.some(
                application => parseInt(application.contribution_id, 16) === parseInt(contributionDto.id, 16)
              ),
              gateMissingCompletedContributions: contributionDto.gate - (completedContributionsAmount || 0),
            };

            return contribution;
          }),
        ];
      },
      []
    );

    return contributionsWithProjects;
  },
});

export const contributorApplicationsQuery = selector<ContributionApplication[]>({
  key: "ContributorApplications",
  get: async ({ get }) => {
    const contributorId = get(userContributorIdSelector);
    if (contributorId === undefined) {
      return [];
    }

    const applications = await applicationRepository.list({ contributorId });

    return applications.map(application => {
      return {
        contribution_id: application.contribution_id,
        contributor_id: application.contributor_id,
      };
    });
  },
});

export const contributionQuery = selectorFamily({
  key: "Contribution",
  get:
    id =>
    ({ get }) => {
      const contributions = get(contributionsQuery);
      return contributions.find(contribution => contribution.id === id);
    },
});

export const projectQuery = selectorFamily({
  key: "Project",
  get:
    id =>
    ({ get }) => {
      const projects = get(projectsQuery);
      return projects.find(project => project.id === id);
    },
});

export const projectContributionsQuery = selectorFamily({
  key: "ProjectContributions",
  get:
    projectId =>
    ({ get }) => {
      const contributions = get(contributionsQuery);
      return contributions
        .filter(contribution => contribution.project.id === projectId)
        .sort(sortContributionsByStatus);
    },
});

export const openedContributionsQuery = selector({
  key: "OpenedContributions",
  get: ({ get }) => {
    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution => contribution.status === ContributionStatusEnum.OPEN && contribution.eligible !== false
    ) as OpenContribution[];
  },
});

export const gatedContributionsQuery = selector({
  key: "GatedContributions",
  get: ({ get }) => {
    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution => contribution.status === ContributionStatusEnum.OPEN && contribution.eligible === false
    ) as OpenContribution[];
  },
});

export const ongoingContributionsQuery = selector({
  key: "OngoingContributions",
  get: ({ get }) => {
    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution => contribution.status === ContributionStatusEnum.ASSIGNED
    ) as AssignedContribution[];
  },
});

export const myAppliedContributionsQuery = selector({
  key: "MyAppliedContributions",
  get: ({ get }) => {
    const userContributorId = get(userContributorIdSelector);

    if (!userContributorId) {
      return [];
    }

    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution => contribution.status === ContributionStatusEnum.OPEN && contribution.applied
    ) as Contribution[];
  },
});

export const myOngoingContributionsQuery = selector({
  key: "MyOngoingContributions",
  get: ({ get }) => {
    const userContributorId = get(accountAddressSelector);

    if (!userContributorId) {
      return [];
    }

    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution =>
        contribution.status === ContributionStatusEnum.ASSIGNED &&
        parseInt(contribution.metadata.assignee, 16) === parseInt(userContributorId, 16)
    ) as AssignedContribution[];
  },
});

export const foreignOngoingContributionsQuery = selector({
  key: "ForeignOngoingContributions",
  get: ({ get }) => {
    const userContributorId = get(accountAddressSelector);
    const contributions = get(contributionsQuery);

    if (!userContributorId) {
      return contributions;
    }

    return contributions.filter(
      contribution =>
        contribution.status === ContributionStatusEnum.ASSIGNED &&
        parseInt(contribution.metadata.assignee, 16) === parseInt(userContributorId, 16)
    ) as AssignedContribution[];
  },
});

export const completedContributionsQuery = selector({
  key: "CompletedContributions",
  get: ({ get }) => {
    const contributions = get(contributionsQuery);
    return contributions.filter(
      contribution => contribution.status === ContributionStatusEnum.COMPLETED
    ) as CompletedContribution[];
  },
});

export const myCompletedContributionsQuery = selector({
  key: "MyCompletedContributions",
  get: ({ get }) => {
    const userContributorId = get(accountAddressSelector);

    if (!userContributorId) {
      return [];
    }

    const contributions = get(contributionsQuery);

    return contributions.filter(
      contribution =>
        contribution.status === ContributionStatusEnum.COMPLETED &&
        parseInt(contribution.metadata.assignee, 16) === parseInt(userContributorId, 16)
    ) as CompletedContribution[];
  },
});

export const foreignCompletedContributionsQuery = selector({
  key: "ForeignCompletedContributions",
  get: ({ get }) => {
    const userContributorId = get(accountAddressSelector);
    const contributions = get(contributionsQuery);

    if (!userContributorId) {
      return contributions;
    }

    return contributions.filter(
      contribution =>
        contribution.status === ContributionStatusEnum.COMPLETED &&
        parseInt(contribution.metadata.assignee, 16) === parseInt(userContributorId, 16)
    ) as CompletedContribution[];
  },
});

export const technologiesQuery = selector({
  key: "Technologies",
  get: ({ get }) => {
    const contributions = get(contributionsQuery);

    const technologies = new Set<string>();

    contributions.forEach(contribution => {
      if (contribution.metadata.technology && !technologies.has(contribution.metadata.technology)) {
        technologies.add(contribution.metadata.technology);
      }
    });

    return Array.from(technologies);
  },
});

export const filteredProjectsSelector = selector({
  key: "FilteredProjects",

  get: ({ get }) => {
    const projects = get(projectsQuery);

    const contributionsFilterContext = get(contributionsFilterContextAtom("projects"));
    const contributionsFilterDifficulty = get(contributionsFilterDifficultyAtom("projects"));
    const contributionsFilterDuration = get(contributionsFilterDurationAtom("projects"));
    const contributionsFilterStatus = get(contributionsFilterStatusAtom("projects"));
    const contributionsFilterTechnology = get(contributionsFilterTechnologyAtom("projects"));
    const contributionsFilterType = get(contributionsFilterTypeAtom("projects"));

    return projects
      .filter(filterProjectByStatuses(contributionsFilterStatus))
      .filter(filterProjectByProperty("contexts", contributionsFilterContext))
      .filter(filterProjectByProperty("difficulties", contributionsFilterDifficulty))
      .filter(filterProjectByProperty("durations", contributionsFilterDuration))
      .filter(filterProjectByProperty("technologies", contributionsFilterTechnology))
      .filter(filterProjectByProperty("types", contributionsFilterType));
  },
});

const contributionStatusPriority: Record<ContributionStatusEnum | "gated" | "applied", number> = {
  [ContributionStatusEnum.OPEN]: 1,
  gated: 2,
  applied: 3,
  [ContributionStatusEnum.ASSIGNED]: 4,
  [ContributionStatusEnum.COMPLETED]: 5,
  [ContributionStatusEnum.ABANDONED]: 6,
};

function sortContributionsByStatus(contribution1: Contribution, contribution2: Contribution) {
  const finalStatus1 =
    contribution1.status === ContributionStatusEnum.OPEN && !contribution1.eligible ? "gated" : contribution1.status;

  const finalStatus2 =
    contribution2.status === ContributionStatusEnum.OPEN && !contribution2.eligible ? "gated" : contribution2.status;

  if (contributionStatusPriority[finalStatus1] === contributionStatusPriority[finalStatus2]) {
    return 0;
  }

  return contributionStatusPriority[finalStatus1] > contributionStatusPriority[finalStatus2] ? 1 : -1;
}

function filterProjectByStatuses(statuses: Array<ContributionStatusEnum | "gated">) {
  return (project: Project) => {
    if (statuses.length === 0) {
      return true;
    }

    return project.statuses.some(status => {
      return statuses.includes(status);
    });
  };
}

function filterProjectByProperty(propertyName: keyof Project, filteredValues: Array<Project[typeof propertyName]>) {
  return (project: Project) => {
    if (filteredValues.length === 0) {
      return true;
    }

    if (!project[propertyName]) {
      return false;
    }

    if (Array.isArray(project[propertyName])) {
      return (project[propertyName] as Array<Project[typeof propertyName]>).some(propertyValue => {
        return filteredValues.includes(propertyValue);
      });
    }

    return filteredValues.includes(project[propertyName]);
  };
}

function countCompletedContributions(
  rawProjectsWithContributions: RawProjectWithContributions[],
  contributorId: ContributorId | undefined
) {
  if (contributorId === undefined) {
    return null;
  }

  return rawProjectsWithContributions.reduce((amount, { contributions }) => {
    return (
      amount +
      contributions.reduce((subAmount, contribution) => {
        if (
          contribution.status === ContributionStatusEnum.COMPLETED &&
          parseInt(contribution.metadata.assignee, 16) === parseInt(contributorId, 16)
        ) {
          return subAmount + 1;
        }
        return subAmount;
      }, 0)
    );
  }, 0);
}

function formatProjectMetadata<T extends keyof ContributionMetadata>(
  metadataName: T,
  contributions: ContributionDto[]
) {
  const metadataSet = new Set<ContributionMetadata[T]>();

  contributions.forEach(contribution => {
    const metadataValue = contribution.metadata[metadataName];

    if (!metadataValue) {
      return;
    }

    metadataSet.add(metadataValue);
  });

  return Array.from(metadataSet);
}

function formatProjectTechnologies(contributions: ContributionDto[]) {
  const technologyCount = new Map<string, number>();

  contributions.forEach(contribution => {
    if (!contribution.metadata.technology) {
      return;
    }

    const currentCount = technologyCount.get(contribution.metadata.technology) || 0;

    technologyCount.set(contribution.metadata.technology, currentCount + 1);
  });

  const technologyCountList = Array.from(technologyCount);

  return technologyCountList
    .sort(([, count1], [, count2]) => {
      if (count1 === count2) {
        return 0;
      }

      return count1 < count2 ? 1 : -1;
    })
    .map(([technology]) => technology);
}

function formatProjectStatuses(contributions: ContributionDto[], completedContributionsAmount: number | null) {
  const statuses = new Set<Contribution["status"] | "gated">();

  contributions.forEach(contribution => {
    const finalStatus =
      contribution.status === ContributionStatusEnum.OPEN &&
      completedContributionsAmount !== null &&
      completedContributionsAmount < contribution.gate
        ? "gated"
        : contribution.status;

    statuses.add(finalStatus);
  });

  return Array.from(statuses);
}

function formatProject(projectDto: Omit<ProjectDto, "contributions">): ProjectBase {
  return {
    ...projectDto,
    members: projectDto.members
      ? projectDto.members.map(member => {
          return (member as ProjectMember).contributor_account
            ? (member as ProjectMember).contributor_account
            : (member as string);
        })
      : [],
  };
}
