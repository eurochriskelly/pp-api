-- Migration to revert slug column to NOT NULL in Listings table
ALTER TABLE Listings MODIFY slug VARCHAR(255) NOT NULL;
