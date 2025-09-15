const bcrypt = require('bcryptjs');


//This is the migration

module.exports = {
  async up(db, client) {
    // Create a group for admins
    const adminGroupResult = await db.collection('groups').insertOne({
      name: 'Admins',
      description: 'Group for administrator accounts',
      maxStudents: 10,
      currentStudents: 1,
      isActive: true,
      createdBy: null, // No creator for the initial admin group
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const adminGroupId = adminGroupResult.insertedId;

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    const adminUserResult = await db.collection('users').insertOne({
      name: 'Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      group: adminGroupId,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const adminUserId = adminUserResult.insertedId;
    
    // Now that we have an admin user, we can set the createdBy for the admin group
    await db.collection('groups').updateOne(
      { _id: adminGroupId },
      { $set: { createdBy: adminUserId } }
    );

    // Create initial groups
    await db.collection('groups').insertMany([
      {
        name: 'Group 1',
        description: 'First initial group',
        maxStudents: 30,
        currentStudents: 0,
        isActive: true,
        createdBy: adminUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Group 2',
        description: 'Second initial group',
        maxStudents: 25,
        currentStudents: 0,
        isActive: true,
        createdBy: adminUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(db, client) {
    // Delete users
    await db.collection('users').deleteOne({ email: 'admin@example.com' });

    // Delete groups
    await db.collection('groups').deleteMany({ name: { $in: ['Admins', 'Group 1', 'Group 2'] } });
  }
};