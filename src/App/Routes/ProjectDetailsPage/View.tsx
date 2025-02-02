import { FC } from "react";

import { Contribution, Project } from "src/state";
import logoPlaceholder from "src/assets/img/project-logo-placeholder.png";
import ContributionList from "src/components/ContributionList";
import BackButton from "src/components/BackButton";
import NotFoundError from "src/App/Routes/ProjectDetailsPage/NotFoundError";

import Link from "./Link";

type Props = {
  contributions: Contribution[];
  project?: Project;
};
const ProjectDetailsPage: FC<Props> = ({ contributions, project }) => {
  if (!project) {
    return <NotFoundError />;
  }

  return (
    <div className="relative flex flex-col items-center mt-8 mb-4 px-2 md:px-8 max-w-screen-xl w-full">
      <BackButton className="absolute left-[16px] top-0" />
      <img className="rounded-full" src={project.logo || logoPlaceholder} width={93} />
      <h2 className="mt-6 font-alfreda text-5xl capitalize leading-snug" data-testid="project-title">
        {project.title}
      </h2>
      <div
        className="mt-6 text-light-purple text-xl text-center font-light leading-8 max-w-[560px]"
        data-testid="project-description"
      >
        {project.description}
      </div>
      <div className="mt-10 flex flex-row gap-4 items-center justify-center">
        {project.website_link && (
          <Link url={project.website_link} dataTestId="project-extlink-website">
            Website
          </Link>
        )}
        {project.github_link && (
          <Link url={project.github_link} dataTestId="project-extlink-github">
            Github
          </Link>
        )}
        {project.discord_link && (
          <Link url={project.discord_link} dataTestId="project-extlink-discord">
            Discord
          </Link>
        )}
      </div>
      <h2 className="mt-20 text-4xl font-alfreda">Contributions</h2>
      <ContributionList className="mt-12" contributions={contributions} />
    </div>
  );
};

export default ProjectDetailsPage;
