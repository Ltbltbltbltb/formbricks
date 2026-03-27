"use server";

import "server-only";
import { ActionClass, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "../constants";
import { getProjectIdFromEnvironmentId } from "../utils/helper";
import { validateInputs } from "../utils/validate";

const selectActionClass = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  description: true,
  type: true,
  key: true,
  noCodeConfig: true,
  environmentId: true,
  projectId: true,
} satisfies Prisma.ActionClassSelect;

export const getActionClasses = reactCache(
  async (projectId: string, page?: number): Promise<TActionClass[]> => {
    validateInputs([projectId, ZId], [page, ZOptionalNumber]);

    try {
      return await prisma.actionClass.findMany({
        where: {
          projectId,
        },
        select: selectActionClass,
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        orderBy: {
          createdAt: "asc",
        },
      });
    } catch (error) {
      throw new DatabaseError(`Database error when fetching actions for project ${projectId}`);
    }
  }
);

// This function is used to get an action by its name and projectId(it can return private actions as well)
export const getActionClassByProjectIdAndName = reactCache(
  async (projectId: string, name: string): Promise<TActionClass | null> => {
    validateInputs([projectId, ZId], [name, ZString]);

    try {
      const actionClass = await prisma.actionClass.findFirst({
        where: {
          name,
          projectId,
        },
        select: selectActionClass,
      });

      return actionClass;
    } catch (error) {
      throw new DatabaseError(`Database error when fetching action`);
    }
  }
);

export const getActionClass = reactCache(async (actionClassId: string): Promise<TActionClass | null> => {
  validateInputs([actionClassId, ZId]);

  try {
    const actionClass = await prisma.actionClass.findUnique({
      where: {
        id: actionClassId,
      },
      select: selectActionClass,
    });

    return actionClass;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching action`);
  }
});

export const deleteActionClass = async (actionClassId: string): Promise<TActionClass> => {
  validateInputs([actionClassId, ZId]);

  try {
    const actionClass = await prisma.actionClass.delete({
      where: {
        id: actionClassId,
      },
      select: selectActionClass,
    });
    if (actionClass === null) throw new ResourceNotFoundError("Action", actionClassId);

    return actionClass;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createActionClass = async (
  environmentId: string,
  actionClass: TActionClassInput
): Promise<ActionClass> => {
  validateInputs([environmentId, ZId], [actionClass, ZActionClassInput]);

  const { environmentId: _, ...actionClassInput } = actionClass;

  try {
    const projectId = await getProjectIdFromEnvironmentId(environmentId);

    const actionClassPrisma = await prisma.actionClass.create({
      data: {
        ...actionClassInput,
        environmentId,
        projectId,
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig:
          actionClassInput.type === "noCode"
            ? actionClassInput.noCodeConfig === null
              ? undefined
              : actionClassInput.noCodeConfig
            : undefined,
      },
      select: selectActionClass,
    });

    return actionClassPrisma;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.UniqueConstraintViolation
    ) {
      const targetField = (error.meta?.target as string[] | undefined)?.[0];
      throw new DatabaseError(
        `Action with ${targetField} ${targetField ? (actionClass as Record<string, unknown>)[targetField] : ""} already exists`
      );
    }

    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};

export const updateActionClass = async (
  environmentId: string,
  actionClassId: string,
  inputActionClass: Partial<TActionClassInput>
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId], [inputActionClass, ZActionClassInput]);

  const { environmentId: _, ...actionClassInput } = inputActionClass;
  try {
    const result = await prisma.actionClass.update({
      where: {
        id: actionClassId,
      },
      data: {
        ...actionClassInput,
        environment: { connect: { id: environmentId } },
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig:
          actionClassInput.type === "noCode"
            ? actionClassInput.noCodeConfig === null
              ? undefined
              : actionClassInput.noCodeConfig
            : undefined,
      },
      select: {
        ...selectActionClass,
        surveyTriggers: {
          select: {
            surveyId: true,
          },
        },
      },
    });

    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.UniqueConstraintViolation
    ) {
      const targetField = (error.meta?.target as string[] | undefined)?.[0];
      throw new DatabaseError(
        `Action with ${targetField} ${targetField ? (inputActionClass as Record<string, unknown>)[targetField] : ""} already exists`
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
