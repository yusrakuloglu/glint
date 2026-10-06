-- AlterEnum
-- Hand-edited: BEFORE keeps the enum order in line with the schema.
-- Its own migration because a new enum value cannot be used (e.g. as a
-- default) in the transaction that adds it.
ALTER TYPE "ContentStatus" ADD VALUE 'AWAITING_CONTENT' BEFORE 'PENDING';
