import dotenv from 'dotenv';
import * as readline from 'readline';
import { VaultClient } from './vault-client';
import { VaultPostgresManager } from './database';
import { seedData, SeedTable } from './data';
import { TenantRegistrationResponse } from './types';
dotenv.config();

// Function to prompt user input from terminal
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function registerTenant(tenantName: string) {
  const tenantData = {
    "name": `${tenantName}`,

    /**  dummy address */
    "phone": "9846677809",
    "email": "info@dummy.edu.np",
    "website": "https://www.dummy.edu.np",
    "logoUrl": "https://www.dummy.edu.np/logo.png",
    "isActive": true,
    "vatNumber": "dummy554433",
    "address": {
      "country": "Japan",
      "state": "Bagmati",
      "city": "pokhara",
      "place": "123 Market Street",
      "street": "Suite 100",
      "isPermanent": true
    }
  };

  try {
    console.log(`Registering tenant: ${tenantData.name}`);
    const response = await fetch('http://localhost:3002/api/v1/tenant-management/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'core'
      },
      body: JSON.stringify(tenantData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tenant registration failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json() as TenantRegistrationResponse;
    console.log('Tenant registered successfully:', result);

    return result.data?.name || tenantData.name;
  } catch (error) {
    console.error('Error registering tenant:', error);
    throw error;
  }
}

async function main() {
  // Step 1: Prompt for tenant name suffix
  const tenantName = await promptUser('Enter tenant name: ');

  if (!tenantName) {
    console.error('Tenant name cannot be empty!');
    process.exit(1);
  }

  // Step 2: Register tenant and get the name
  const tenant = await registerTenant(tenantName);
  console.log(`\n✓ Using tenant: ${tenantName}\n`);

  // Step 3: Initialize Vault and DB manager with the tenant name
  const vaultClient = new VaultClient(
    process.env.VAULT_ADDRESS!,
    process.env.VAULT_TOKEN!
  );

  const dbManager = new VaultPostgresManager(
    vaultClient,
    tenant
  );

  await dbManager.connect();

  try {
    console.log('Starting database seeding...');
    await dbManager.query('BEGIN');

    // Define seeding order based on dependencies
    const seedOrder = [
      'users',
      'address',
      'entity_address',
      'emergency_contacts',
      'user_additional_infos',
      'user_certifications',
      'user_qualifications',
      'academic_years',
      'classes',
      'class_sections',
      'subjects',
      'class_subjects',
      'student_enrollments',
      'student_parents',
      'week_days',
      'time_periods',
      'teacher_assignments',
      'class_section_timetables',
      // 'meals',
      'notice',
      'notice_class_sections',
      'leave_requests',
      'role',
      'user_roles',
      'permission',
      'role_permission',
    ] as const;

    for (const table of seedOrder as readonly SeedTable[]) {
      if (seedData[table]) {
        console.log(`→ Seeding ${table}...`);
        const insert = buildBulkInsert(table, seedData[table]);

        if (insert) {
          await dbManager.query(insert.query, insert.values);
          console.log(`  ✓ Seeded ${seedData[table].length} records into ${table}`);
        }
      }
    }

    await dbManager.query('COMMIT');
    console.log('\n✓ Database seeding completed successfully!');
    process.exit(1)
  } catch (error) {
    await dbManager.query('ROLLBACK');
    console.error('\n✗ Error seeding database:', error);
    throw error;
  }
}

function buildBulkInsert(table: string, data: Record<string, any>[]) {
  if (!data?.length) return null;

  const columns = Object.keys(data[0]);

  const values = data
    .map((_, rowIdx) => {
      const placeholders = columns.map(
        (_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`
      );
      return `(${placeholders.join(', ')})`;
    })
    .join(', ');

  const flatValues = data.flatMap(row =>
    columns.map(col => row[col])
  );

  return {
    query: `
      INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
    values: flatValues
  };
}

// Execute the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});