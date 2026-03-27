import { ActionClass } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getActionClasses = reactCache(async (projectId: string): Promise<ActionClass[]> => {
  validateInputs([projectId, z.cuid2()]);

  try {
    return await prisma.actionClass.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  } catch (error) {
    throw new DatabaseError(`Database error when fetching actions for project ${projectId}`);
  }
});
